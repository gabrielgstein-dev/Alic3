export class NormalizationUtil {
  static normalizeModName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_');
  }

  static removeStopWords(text: string): string {
    const stopWords = ['the', 'a', 'an', 'mod', 'pack', 'update', 'v1', 'v2', 'v3', 'new', 'fixed'];
    const words = text.toLowerCase().split(/\s+/);
    const filtered = words.filter(word => !stopWords.includes(word));
    
    return filtered.length >= 3 ? filtered.join(' ') : words.join(' ');
  }

  static normalizeVersion(version: string | null, publishedAt: Date): string {
    if (!version) {
      const date = new Date(publishedAt);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    }

    let normalized = version
      .toLowerCase()
      .replace(/^v/, '')
      .replace(/version\s*/i, '')
      .replace(/update\s*/i, '')
      .trim();

    const parts = normalized.split('.').map(p => p.replace(/\D/g, '')).filter(p => p);
    
    while (parts.length < 3) {
      parts.push('0');
    }

    return parts.slice(0, 3).join('.');
  }

  static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      if (num1 !== num2) {
        return num1 - num2;
      }
    }

    return 0;
  }

  static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
