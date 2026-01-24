import { Property, FilterCriteria } from '../types/property.js';

/**
 * Default Broganda family criteria
 */
export const DEFAULT_CRITERIA: FilterCriteria = {
  minBedrooms: 4,
  minBaths: 2.5,
  maxWalkMinutes: 15,
  maxPrice: null, // No price limit by default
  augustRequired: false // Don't filter out unknown availability
};

/**
 * Check if a property meets the Broganda criteria
 */
export function meetsCriteria(property: Property, criteria: FilterCriteria = DEFAULT_CRITERIA): boolean {
  // Must have minimum bedrooms
  if (property.bedrooms < criteria.minBedrooms) {
    return false;
  }

  // Must have minimum bathrooms
  if (property.baths < criteria.minBaths) {
    return false;
  }

  // Must be within walk distance
  if (property.walkMinutes > criteria.maxWalkMinutes) {
    return false;
  }

  // Check price if limit is set
  if (criteria.maxPrice !== null && property.price !== null) {
    if (property.price > criteria.maxPrice) {
      return false;
    }
  }

  // Check August availability if required
  if (criteria.augustRequired && property.augustAvailable === false) {
    return false;
  }

  return true;
}

/**
 * Calculate a match score for a property (0-100)
 * Higher scores = better match for Broganda criteria
 */
export function calculateScore(property: Property, criteria: FilterCriteria = DEFAULT_CRITERIA): number {
  let score = 0;

  // Base score for meeting minimum criteria
  if (meetsCriteria(property, criteria)) {
    score = 50;
  } else {
    // Partial score if close to criteria
    if (property.bedrooms >= criteria.minBedrooms - 1) score += 10;
    if (property.baths >= criteria.minBaths - 0.5) score += 10;
    if (property.walkMinutes <= criteria.maxWalkMinutes + 5) score += 10;
    return score;
  }

  // Bonus points for exceeding criteria

  // Extra bedrooms (up to +15 points)
  const extraBedrooms = property.bedrooms - criteria.minBedrooms;
  score += Math.min(extraBedrooms * 5, 15);

  // Extra bathrooms (up to +10 points)
  const extraBaths = property.baths - criteria.minBaths;
  score += Math.min(extraBaths * 5, 10);

  // Walk time bonus (closer is better, up to +15 points)
  if (property.walkMinutes <= 5) {
    score += 15;
  } else if (property.walkMinutes <= 10) {
    score += 10;
  } else if (property.walkMinutes <= 15) {
    score += 5;
  }

  // Availability bonus
  if (property.augustAvailable === true) {
    score += 10;
  }

  // Feature bonuses
  const valuableFeatures = [
    'a/c', 'air conditioning', 'central a/c',
    'pool', 'hot tub',
    'ocean view', 'water view', 'beach view',
    'wrap porch', 'wraparound porch',
    'chef kitchen', 'gourmet kitchen',
    'outdoor shower'
  ];

  const propertyFeatures = property.features.map(f => f.toLowerCase()).join(' ');
  const propertyDescription = property.description.toLowerCase();
  const allText = `${propertyFeatures} ${propertyDescription}`;

  let featureBonus = 0;
  for (const feature of valuableFeatures) {
    if (allText.includes(feature)) {
      featureBonus += 2;
    }
  }
  score += Math.min(featureBonus, 10);

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Filter and score a list of properties
 */
export function filterProperties(
  properties: Property[],
  criteria: FilterCriteria = DEFAULT_CRITERIA,
  includeNonMatching: boolean = false
): Property[] {
  return properties
    .map(p => ({
      ...p,
      score: calculateScore(p, criteria)
    }))
    .filter(p => includeNonMatching || meetsCriteria(p, criteria))
    .sort((a, b) => b.score - a.score);
}

/**
 * Merge new properties with existing ones, preserving firstSeen dates
 */
export function mergeProperties(existing: Property[], newProperties: Property[]): Property[] {
  const today = new Date().toISOString().split('T')[0];
  const existingMap = new Map(existing.map(p => [p.id, p]));

  const merged: Property[] = [];
  const seenIds = new Set<string>();

  for (const newProp of newProperties) {
    const existingProp = existingMap.get(newProp.id);

    if (existingProp) {
      // Update existing property
      merged.push({
        ...newProp,
        firstSeen: existingProp.firstSeen,
        lastSeen: today,
        isNew: false
      });
    } else {
      // New property
      merged.push({
        ...newProp,
        firstSeen: today,
        lastSeen: today,
        isNew: true
      });
    }

    seenIds.add(newProp.id);
  }

  // Keep old properties that weren't found (might just be temporary)
  // Mark them as stale after 7 days
  for (const existing of existingMap.values()) {
    if (!seenIds.has(existing.id)) {
      const lastSeenDate = new Date(existing.lastSeen);
      const daysSinceLastSeen = Math.floor((Date.now() - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastSeen < 7) {
        merged.push(existing);
      }
      // Properties not seen for 7+ days are dropped
    }
  }

  return merged;
}

/**
 * Find newly added properties that meet criteria
 */
export function findNewMatches(
  oldProperties: Property[],
  newProperties: Property[],
  criteria: FilterCriteria = DEFAULT_CRITERIA
): Property[] {
  const oldIds = new Set(oldProperties.map(p => p.id));

  return newProperties.filter(p =>
    !oldIds.has(p.id) && meetsCriteria(p, criteria)
  );
}
