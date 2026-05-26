/**
 * Utility functions για αναζήτηση κειμένου
 */

/**
 * Κανονικοποιεί κείμενο για αναζήτηση:
 * - Μετατρέπει σε πεζά γράμματα
 * - Αφαιρεί τόνους από ελληνικά γράμματα
 * - Αφαιρεί διαστήματα στην αρχή και το τέλος
 * 
 * @param {string} text - Το κείμενο προς κανονικοποίηση
 * @returns {string} - Το κανονικοποιημένο κείμενο
 */
export const normalizeSearchText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    // Αφαίρεση τόνων από ελληνικά γράμματα
    .replace(/ά/g, 'α')
    .replace(/έ/g, 'ε')
    .replace(/ή/g, 'η')
    .replace(/ί/g, 'ι')
    .replace(/ό/g, 'ο')
    .replace(/ύ/g, 'υ')
    .replace(/ώ/g, 'ω')
    .replace(/ΐ/g, 'ι')
    .replace(/ΰ/g, 'υ')
    // Αφαίρεση τόνων από κεφαλαία (για περιπτώσεις που υπάρχουν)
    .replace(/Ά/g, 'α')
    .replace(/Έ/g, 'ε')
    .replace(/Ή/g, 'η')
    .replace(/Ί/g, 'ι')
    .replace(/Ό/g, 'ο')
    .replace(/Ύ/g, 'υ')
    .replace(/Ώ/g, 'ω');
};

/**
 * Ελέγχει αν ένα κείμενο περιέχει έναν όρο αναζήτησης
 * χρησιμοποιώντας κανονικοποιημένη σύγκριση
 * 
 * @param {string} text - Το κείμενο στο οποίο γίνεται αναζήτηση
 * @param {string} searchTerm - Ο όρος αναζήτησης
 * @returns {boolean} - true αν βρέθηκε ο όρος
 */
export const containsSearchTerm = (text, searchTerm) => {
  if (!text || !searchTerm) return false;
  
  const normalizedText = normalizeSearchText(text);
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  
  return normalizedText.includes(normalizedSearchTerm);
};

/**
 * Φιλτράρει έναν πίνακα αντικειμένων βάσει ενός όρου αναζήτησης
 * σε συγκεκριμένα πεδία
 * 
 * @param {Array} items - Ο πίνακας των αντικειμένων
 * @param {string} searchTerm - Ο όρος αναζήτησης
 * @param {Array} fields - Τα πεδία στα οποία γίνεται αναζήτηση
 * @returns {Array} - Ο φιλτραρισμένος πίνακας
 */
export const filterBySearchTerm = (items, searchTerm, fields) => {
  if (!searchTerm || !searchTerm.trim()) return items;
  
  return items.filter(item => 
    fields.some(field => containsSearchTerm(item[field], searchTerm))
  );
};
