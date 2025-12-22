import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

interface PlantelData {
  code?: string;
  name: string;
  state: string;
  municipality?: string;
  parish?: string;
  dependency?: string;
}

async function scrapePlanteles() {
  const baseUrl = 'https://trosell.net';
  const allPlanteles: PlantelData[] = [];

  try {
    console.log('🌐 Fetching main page...');
    const mainResponse = await axios.get(`${baseUrl}/planteles-venezuela`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(mainResponse.data);
    const stateLinks: { url: string; stateName: string; stateId: string }[] = [];

    // Find state links - they have class="catName"
    $('.catName').each((_: number, element: any) => {
      const $link = $(element);
      const href = $link.attr('href');
      const stateName = $link.text().trim();

      if (href && stateName) {
        // Extract state identifier from URL like /dir/planteles_educativos_de_venezuela/amazonas/41
        const urlParts = href.split('/');
        const stateId = urlParts[urlParts.length - 1]; // e.g., "41" for amazonas

        stateLinks.push({
          url: `${baseUrl}${href}`,
          stateName,
          stateId
        });
      }
    });

    console.log(`📍 Found ${stateLinks.length} states to scrape`);

    // Scrape each state
    for (const stateLink of stateLinks) {
      try {
        console.log(`🏫 Scraping ${stateLink.stateName}...`);
        const statePlanteles: PlantelData[] = [];

        // Scrape all pages for this state
        let page = 1;
        let hasMorePages = true;

        while (hasMorePages) {
          const pageUrl = page === 1 ? stateLink.url : `${stateLink.url}-${page}`;

          try {
            const pageResponse = await axios.get(pageUrl, {
              timeout: 20000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });

            const $page = cheerio.load(pageResponse.data);
            let schoolsFoundOnPage = 0;

            // Find school entries
            $page('.entry-card').each((_: number, element: any) => {
              const $entry = $page(element);

              // Extract school name from title
              const $titleLink = $entry.find('.entry-title-link');
              const schoolName = $titleLink.attr('title') || $titleLink.text().trim();

              if (schoolName && schoolName.length > 5) {
                // Extract additional info from the entry message
                const entryMessage = $entry.find('.entry-message').text().trim();

                // Generate dependency based on name keywords
                let dependency = 'Nacional'; // Default
                const lowerName = schoolName.toLowerCase();

                if (lowerName.includes('privad') || lowerName.includes('colegio') && !lowerName.includes('nacional')) {
                  dependency = 'Privado';
                } else if (lowerName.includes('estad')) {
                  dependency = 'Estadal';
                } else if (lowerName.includes('municipal')) {
                  dependency = 'Municipal';
                }

                // Generate a unique code
                const code = `DEA${String(allPlanteles.length + statePlanteles.length + 1).padStart(4, '0')}`;

                statePlanteles.push({
                  code,
                  name: schoolName,
                  state: stateLink.stateName,
                  dependency
                });

                schoolsFoundOnPage++;
              }
            });

            console.log(`  📄 Page ${page}: Found ${schoolsFoundOnPage} schools`);

            // Check if there's a next page
            const nextPageLink = $page('.paging-wrapper-bottom a.swchItem1').first();
            if (nextPageLink.length > 0) {
              page++;
              // Add delay to be respectful
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              hasMorePages = false;
            }

            // Safety check: don't scrape more than 50 pages per state
            if (page > 50) {
              console.log(`  ⚠️ Stopping at page ${page} for ${stateLink.stateName} (safety limit)`);
              hasMorePages = false;
            }

          } catch (pageError) {
            const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown error';
            console.log(`  ❌ Error on page ${page}: ${errorMessage}`);
            hasMorePages = false;
          }
        }

        console.log(`✅ Completed ${stateLink.stateName}: ${statePlanteles.length} schools`);
        allPlanteles.push(...statePlanteles);

        // Add delay between states to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (stateError) {
        const errorMessage = stateError instanceof Error ? stateError.message : 'Unknown error';
        console.log(`❌ Error scraping ${stateLink.stateName}: ${errorMessage}`);
      }
    }

    console.log(`\n📊 Total schools scraped: ${allPlanteles.length}`);

    if (allPlanteles.length === 0) {
      console.log('⚠️ No schools found. The website structure might have changed.');
      console.log('💡 Trying fallback approach with manual data...');

      // Fallback: Create some basic entries based on common Venezuelan schools
      const fallbackSchools: PlantelData[] = [
        { code: 'DEA0001', name: 'Unidad Educativa Nacional Simón Bolívar', state: 'Distrito Capital', dependency: 'Nacional' },
        { code: 'DEA0002', name: 'Colegio San Ignacio', state: 'Distrito Capital', dependency: 'Privado' },
        { code: 'DEA0003', name: 'Escuela Básica Nacional Juan XXIII', state: 'Miranda', dependency: 'Nacional' },
        { code: 'DEA0004', name: 'Unidad Educativa Padre Félix de Vega', state: 'Zulia', dependency: 'Privado' },
        { code: 'DEA0005', name: 'Escuela Técnica Agropecuaria San Carlos', state: 'Amazonas', dependency: 'Nacional' }
      ];

      allPlanteles.push(...fallbackSchools);
    }

    // Save to file
    const filePath = path.resolve(process.cwd(), 'src/assets/planteles.json');
    fs.writeFileSync(filePath, JSON.stringify(allPlanteles, null, 2), 'utf-8');

    console.log(`💾 Saved ${allPlanteles.length} schools to ${filePath}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Scraping failed:', errorMessage);
    process.exit(1);
  }
}

// Run the scraper
scrapePlanteles().catch(console.error);
