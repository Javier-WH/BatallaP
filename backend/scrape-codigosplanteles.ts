import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface PlantelData {
  name: string;
  state: string;
  deaCode?: string;
  url?: string;
}

// Known list of Venezuelan states
const states = [
  'amazonas',
  'anzoategui',
  'apure',
  'aragua',
  'barinas',
  'bolivar',
  'carabobo',
  'cojedes',
  'delta-amacuro',
  'distrito-capital',
  'falcon',
  'guarico',
  'lara',
  'merida',
  'miranda',
  'monagas',
  'nueva-esparta',
  'portuguesa',
  'sucre',
  'tachira',
  'trujillo',
  'vargas',
  'yaracuy',
  'zulia'
];

async function scrapeCodigosPlanteles() {
  const baseUrl = 'https://codigosplanteles.info';
  const allPlanteles: PlantelData[] = [];

  let browser;
  try {
    console.log('🚀 Iniciando Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Scrape each state
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      console.log(`\n🏫 Procesando estado ${i + 1}/${states.length}: ${state.toUpperCase()}`);

      try {
        let pageNumber = 1;
        let hasMorePages = true;
        const statePlanteles: { url: string; name: string }[] = [];

        // Iterate through all pages for this state
        while (hasMorePages) {
          const pageUrl = pageNumber === 1 ? `${baseUrl}/${state}/` : `${baseUrl}/${state}/page/${pageNumber}/`;
          console.log(`  📄 Procesando página ${pageNumber}: ${pageUrl}`);

          try {
            const response = await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Check if page exists (204 means no more pages)
            if (response && response.status() === 204) {
              console.log(`  ✅ No más páginas para ${state.toUpperCase()}`);
              hasMorePages = false;
              break;
            }

            // Get all plantel links using specific CSS selector
            const plantelLinks = await page.evaluate(() => {
              const links: { url: string; name: string }[] = [];
              const elements = document.querySelectorAll('.entry-title a');
              elements.forEach((element) => {
                const anchor = element as HTMLAnchorElement;
                const href = anchor.href;
                const name = anchor.textContent?.trim();
                if (href && name) {
                  links.push({ url: href, name });
                }
              });
              return links;
            });

            if (plantelLinks.length === 0) {
              console.log(`  ⚠️ No planteles found on page ${pageNumber}`);
              hasMorePages = false;
              break;
            }

            console.log(`  📍 Found ${plantelLinks.length} planteles on page ${pageNumber}`);
            statePlanteles.push(...plantelLinks);
            pageNumber++;

            // Small delay between page requests
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (pageError) {
            const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown error';
            console.log(`  ❌ Error on page ${pageNumber}: ${errorMessage}`);
            hasMorePages = false;
            break;
          }
        }

        console.log(`  📊 Total planteles in ${state.toUpperCase()}: ${statePlanteles.length}`);

        // Scrape each plantel
        for (let j = 0; j < statePlanteles.length; j++) {
          const plantelLink = statePlanteles[j];
          console.log(`  🏫 Procesando plantel ${j + 1}/${statePlanteles.length}: ${plantelLink.name}`);

          try {
            await page.goto(plantelLink.url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Extract DEA code using specific CSS selector
            const deaCode = await page.evaluate(() => {
              const deaElement = document.querySelector('.codigo-dea p');
              return deaElement?.textContent?.trim() || undefined;
            });

            if (deaCode) {
              const plantelData: PlantelData = {
                name: plantelLink.name,
                state: state.toUpperCase(),
                deaCode: deaCode,
                url: plantelLink.url
              };
              allPlanteles.push(plantelData);
              console.log(`    ✅ ${plantelLink.name} - DEA: ${deaCode}`);
            } else {
              console.log(`    ⚠️ No DEA code found for ${plantelLink.name}`);
            }

            // Small delay between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 200));

          } catch (plantelError) {
            const errorMessage = plantelError instanceof Error ? plantelError.message : 'Unknown error';
            console.log(`    ❌ Error scraping ${plantelLink.name}: ${errorMessage}`);
          }
        }

        console.log(`✅ Completed ${state.toUpperCase()}: ${allPlanteles.length} total schools so far`);

        // Delay between states
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (stateError) {
        const errorMessage = stateError instanceof Error ? stateError.message : 'Unknown error';
        console.log(`❌ Error scraping ${state}: ${errorMessage}`);
      }
    }

    console.log(`\n📊 Total schools scraped: ${allPlanteles.length}`);

    // Save to file
    const filePath = path.resolve(process.cwd(), 'src/assets/planteles.json');
    fs.writeFileSync(filePath, JSON.stringify(allPlanteles, null, 2), 'utf-8');

    console.log(`💾 Saved ${allPlanteles.length} schools to ${filePath}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Scraping failed:', errorMessage);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the scraper
scrapeCodigosPlanteles().catch(console.error);
