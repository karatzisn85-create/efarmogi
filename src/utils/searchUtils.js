/**
 * Utility functions για αναζήτηση κειμένου — ίδια κανονικοποίηση με τον πυρήνα κάρτας.
 */
import subprojectCard from '../../app/core/subprojectCard';

export const normalizeSearchText = subprojectCard.normalizeSearchText;
export const containsSearchTerm = subprojectCard.containsSearchTerm;

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
