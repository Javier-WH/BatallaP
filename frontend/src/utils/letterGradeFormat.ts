import api from '@/services/api';

export interface LetterGrade {
  letter: string;
  max: number;
}

/**
 * Fetches the letter grade configuration from the backend settings
 */
export async function fetchLetterGrades(): Promise<LetterGrade[]> {
  try {
    const res = await api.get('/settings');
    console.log('[fetchLetterGrades] Settings response:', res.data);
    if (res.data?.letter_grades) {
      const parsed = JSON.parse(res.data.letter_grades);
      console.log('[fetchLetterGrades] Parsed letter grades:', parsed);
      // The parsed value is an object with a 'scale' property
      if (parsed.scale && Array.isArray(parsed.scale)) {
        return parsed.scale;
      }
      // If it's already an array, return it
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error fetching letter grades:', error);
  }
  // Default configuration if not set
  return [
    { letter: 'A', max: 20 },
    { letter: 'B', max: 15 },
    { letter: 'C', max: 10 },
    { letter: 'D', max: 5 },
    { letter: 'E', max: 0 }
  ];
}

/**
 * Converts a numeric grade to its letter equivalent based on the letter grade configuration
 * @param numericGrade - The numeric grade to convert
 * @param letterGrades - The letter grade configuration
 * @returns The letter equivalent, or the numeric grade if no letter configuration is provided
 */
export function numericToLetter(numericGrade: number, letterGrades: LetterGrade[]): string {
  if (!letterGrades || letterGrades.length === 0) {
    return String(numericGrade);
  }

  // Sort letter grades by max in descending order (highest to lowest)
  const sortedGrades = [...letterGrades].sort((a, b) => b.max - a.max);

  // Find the matching grade: grade should be <= current.max and > next.max
  for (let i = 0; i < sortedGrades.length; i++) {
    const currentGrade = sortedGrades[i];
    const nextGrade = sortedGrades[i + 1];

    // If this is the last grade (lowest), check if grade <= current.max
    if (!nextGrade) {
      if (numericGrade <= currentGrade.max) {
        return currentGrade.letter;
      }
    } else {
      // Check if grade is in the range: (next.max, current.max]
      if (numericGrade > nextGrade.max && numericGrade <= currentGrade.max) {
        return currentGrade.letter;
      }
    }
  }

  // If no match found (shouldn't happen with proper configuration), return numeric
  return String(numericGrade);
}
