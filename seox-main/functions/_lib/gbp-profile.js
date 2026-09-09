// Mapping between the Business Information API Location resource and the flat
// shape the profile editor works with, plus the updateMask builder.
//
// Writes are per-section on purpose. Google replaces whatever the updateMask
// names, so sending one broad mask with a partially-filled body silently wipes
// fields the user never touched. Each section here emits only its own mask.

export const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

// section -> the updateMask paths it owns.
export const SECTION_MASKS = {
  name: ['title'],
  storeCode: ['storeCode'],
  categories: ['categories'],
  phone: ['phoneNumbers'],
  website: ['websiteUri'],
  address: ['storefrontAddress'],
  serviceArea: ['serviceArea'],
  regularHours: ['regularHours'],
  specialHours: ['specialHours'],
  moreHours: ['moreHours'],
  description: ['profile'],
  openingDate: ['openInfo'],
  services: ['serviceItems'],
  labels: ['labels'],
};

export const EDITABLE_SECTIONS = Object.keys(SECTION_MASKS);

function pad(value) {
  return String(value ?? 0).padStart(2, '0');
}

export function timeToString(time) {
  if (!time) return null;
  return `${pad(time.hours || 0)}:${pad(time.minutes || 0)}`;
}

export function stringToTime(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(':').map((part) => Number(part));
  if (Number.isNaN(hours)) return null;
  const time = { hours };
  if (minutes) time.minutes = minutes;
  return time;
}

export function periodsToDays(periods) {
  const byDay = Object.fromEntries(DAYS.map((day) => [day, { day, closed: true, ranges: [] }]));
  for (const period of periods || []) {
    const day = period.openDay;
    if (!byDay[day]) continue;
    byDay[day].closed = false;
    byDay[day].ranges.push({
      open: timeToString(period.openTime) || '00:00',
      close: timeToString(period.closeTime) || '00:00',
    });
  }
  return DAYS.map((day) => byDay[day]);
}

export function daysToPeriods(days) {
  const periods = [];
  for (const entry of days || []) {
    if (entry.closed) continue;
    for (const range of entry.ranges || []) {
      if (!range.open || !range.close) continue;
      periods.push({
        openDay: entry.day,
        openTime: stringToTime(range.open),
        closeDay: entry.day,
        closeTime: stringToTime(range.close),
      });
    }
  }
  return periods;
}

function dateToParts(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map((part) => Number(part));
  if (!year) return null;
  return { year, month: month || 1, day: day || 1 };
}

function partsToDate(parts) {
  if (!parts?.year) return null;
  return `${parts.year}-${pad(parts.month || 1)}-${pad(parts.day || 1)}`;
}

// --- Google -> editor ------------------------------------------------------

export function toEditableProfile(location, attributes) {
  const categories = location.categories || {};
  const address = location.storefrontAddress || {};

  return {
    locationId: location.name,
    languageCode: location.languageCode || 'en',
    name: location.title || '',
    storeCode: location.storeCode || '',
    primaryCategory: categories.primaryCategory
      ? {
          id: categories.primaryCategory.name,
          label: categories.primaryCategory.displayName,
        }
      : null,
    additionalCategories: (categories.additionalCategories || []).map((category) => ({
      id: category.name,
      label: category.displayName,
    })),
    phone: location.phoneNumbers?.primaryPhone || '',
    additionalPhones: location.phoneNumbers?.additionalPhones || [],
    website: location.websiteUri || '',
    address: {
      regionCode: address.regionCode || '',
      languageCode: address.languageCode || '',
      postalCode: address.postalCode || '',
      administrativeArea: address.administrativeArea || '',
      locality: address.locality || '',
      addressLines: address.addressLines || [],
    },
    serviceArea: {
      businessType: location.serviceArea?.businessType || null,
      places: (location.serviceArea?.places?.placeInfos || []).map((place) => ({
        placeId: place.placeId,
        placeName: place.placeName,
      })),
    },
    regularHours: periodsToDays(location.regularHours?.periods),
    specialHours: (location.specialHours?.specialHourPeriods || []).map((period) => ({
      startDate: partsToDate(period.startDate),
      endDate: partsToDate(period.endDate),
      closed: Boolean(period.closed),
      open: timeToString(period.openTime),
      close: timeToString(period.closeTime),
    })),
    moreHours: (location.moreHours || []).map((entry) => ({
      hoursTypeId: entry.hoursTypeId,
      days: periodsToDays(entry.periods),
    })),
    description: location.profile?.description || '',
    openingDate: partsToDate(location.openInfo?.openingDate),
    openStatus: location.openInfo?.status || null,
    labels: location.labels || [],
    services: (location.serviceItems || []).map((item) => ({
      // A service is either one of Google's structured types for the category,
      // or free text the merchant wrote.
      structuredServiceTypeId: item.structuredServiceItem?.serviceTypeId || null,
      description:
        item.structuredServiceItem?.description || item.freeFormServiceItem?.label?.description || '',
      label: item.freeFormServiceItem?.label?.displayName || null,
      categoryId: item.freeFormServiceItem?.category || null,
      price: item.price || null,
    })),
    attributes: (attributes?.attributes || []).map((attribute) => ({
      name: attribute.name,
      valueType: attribute.valueType,
      values: attribute.values || [],
      repeatedEnumValue: attribute.repeatedEnumValue || null,
      uriValues: attribute.uriValues || null,
    })),
    readOnly: {
      verificationStatus: location.metadata?.hasVoiceOfMerchant ? 'VERIFIED' : 'UNVERIFIED',
      mapsUri: location.metadata?.mapsUri || null,
      placeId: location.metadata?.placeId || null,
      hasPendingEdits: Boolean(location.metadata?.hasPendingEdits),
      canOperateLocalPost: location.metadata?.canOperateLocalPost !== false,
    },
  };
}

// --- Editor -> Google ------------------------------------------------------

function buildSectionBody(section, value) {
  switch (section) {
    case 'name':
      return { title: String(value || '').trim() };
    case 'storeCode':
      return { storeCode: String(value || '').trim() };
    case 'categories':
      return {
        categories: {
          primaryCategory: value?.primaryCategory?.id ? { name: value.primaryCategory.id } : undefined,
          additionalCategories: (value?.additionalCategories || [])
            .filter((category) => category?.id)
            .map((category) => ({ name: category.id })),
        },
      };
    case 'phone':
      return {
        phoneNumbers: {
          primaryPhone: String(value?.primary || '').trim(),
          additionalPhones: (value?.additional || []).filter(Boolean),
        },
      };
    case 'website':
      return { websiteUri: String(value || '').trim() };
    case 'address':
      return {
        storefrontAddress: {
          regionCode: value?.regionCode || undefined,
          languageCode: value?.languageCode || undefined,
          postalCode: value?.postalCode || undefined,
          administrativeArea: value?.administrativeArea || undefined,
          locality: value?.locality || undefined,
          addressLines: (value?.addressLines || []).filter(Boolean),
        },
      };
    case 'serviceArea':
      return {
        serviceArea: {
          businessType: value?.businessType || undefined,
          places: {
            placeInfos: (value?.places || [])
              .filter((place) => place?.placeId)
              .map((place) => ({ placeId: place.placeId, placeName: place.placeName })),
          },
        },
      };
    case 'regularHours':
      return { regularHours: { periods: daysToPeriods(value) } };
    case 'specialHours':
      return {
        specialHours: {
          specialHourPeriods: (value || [])
            .filter((period) => period?.startDate)
            .map((period) => ({
              startDate: dateToParts(period.startDate),
              endDate: dateToParts(period.endDate || period.startDate),
              closed: Boolean(period.closed),
              ...(period.closed
                ? {}
                : { openTime: stringToTime(period.open), closeTime: stringToTime(period.close) }),
            })),
        },
      };
    case 'moreHours':
      return {
        moreHours: (value || [])
          .filter((entry) => entry?.hoursTypeId)
          .map((entry) => ({ hoursTypeId: entry.hoursTypeId, periods: daysToPeriods(entry.days) })),
      };
    case 'description':
      return { profile: { description: String(value || '').trim() } };
    case 'openingDate':
      return { openInfo: { openingDate: dateToParts(value) } };
    case 'labels':
      return { labels: (value || []).map((label) => String(label).trim()).filter(Boolean) };
    case 'services':
      return {
        serviceItems: (value || [])
          .filter((service) => service?.structuredServiceTypeId || service?.label)
          .map((service) =>
            service.structuredServiceTypeId
              ? {
                  structuredServiceItem: {
                    serviceTypeId: service.structuredServiceTypeId,
                    description: service.description || undefined,
                  },
                }
              : {
                  freeFormServiceItem: {
                    category: service.categoryId || undefined,
                    label: {
                      displayName: service.label,
                      description: service.description || undefined,
                      languageCode: service.languageCode || 'en',
                    },
                  },
                }
          ),
      };
    default:
      return null;
  }
}

export function buildSectionPatch(section, value) {
  const mask = SECTION_MASKS[section];
  if (!mask) {
    const error = new Error(`"${section}" is not an editable profile section.`);
    error.status = 400;
    throw error;
  }
  const body = buildSectionBody(section, value);
  if (!body) {
    const error = new Error(`No patch could be built for section "${section}".`);
    error.status = 400;
    throw error;
  }
  return { body, mask };
}

// --- Validation ------------------------------------------------------------

const DESCRIPTION_LIMIT = 750;

export function validateSection(section, value) {
  const errors = [];

  if (section === 'name') {
    const title = String(value || '').trim();
    if (!title) errors.push('Business name cannot be empty.');
    if (title.length > 300) errors.push('Business name is longer than 300 characters.');
    // Google rejects listings that pad the name with keywords or a city.
    if (/\b(best|cheap|no\.?\s?1|#1|top|24\/7)\b/i.test(title)) {
      errors.push(
        'Business name looks like it contains marketing keywords. Google suspends listings for keyword stuffing in the name.'
      );
    }
  }

  if (section === 'description') {
    const description = String(value || '').trim();
    if (description.length > DESCRIPTION_LIMIT) {
      errors.push(`Description is ${description.length} characters; Google allows ${DESCRIPTION_LIMIT}.`);
    }
    if (/https?:\/\//i.test(description)) {
      errors.push('Google strips URLs from the business description.');
    }
  }

  if (section === 'website') {
    const website = String(value || '').trim();
    if (website && !/^https?:\/\//i.test(website)) {
      errors.push('Website URL must start with http:// or https://');
    }
  }

  if (section === 'categories') {
    if (!value?.primaryCategory?.id) errors.push('A primary category is required.');
    if ((value?.additionalCategories || []).length > 9) {
      errors.push('Google allows at most 9 additional categories.');
    }
  }

  if (section === 'regularHours') {
    for (const day of value || []) {
      if (day.closed) continue;
      for (const range of day.ranges || []) {
        if (!range.open || !range.close) {
          errors.push(`${day.day}: both an opening and a closing time are required.`);
        }
      }
    }
  }

  if (section === 'labels' && (value || []).length > 10) {
    errors.push('Google allows at most 10 labels.');
  }

  return errors;
}

// --- Diffing ---------------------------------------------------------------

export function diffProfiles(before, after) {
  const changed = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    if (key === 'readOnly' || key === 'attributes') continue;
    const left = JSON.stringify(before?.[key] ?? null);
    const right = JSON.stringify(after?.[key] ?? null);
    if (left !== right) changed.push(key);
  }
  return changed;
}
