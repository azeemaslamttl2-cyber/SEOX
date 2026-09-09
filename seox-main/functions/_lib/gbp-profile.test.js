import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SECTION_MASKS,
  buildSectionPatch,
  daysToPeriods,
  diffProfiles,
  periodsToDays,
  toEditableProfile,
  validateSection,
} from './gbp-profile.js';

const googleLocation = {
  name: 'locations/123',
  title: 'ABC Plumbing',
  storeCode: 'LHR-01',
  languageCode: 'en',
  categories: {
    primaryCategory: { name: 'gcid:plumber', displayName: 'Plumber' },
    additionalCategories: [{ name: 'gcid:drainage_service', displayName: 'Drainage service' }],
  },
  phoneNumbers: { primaryPhone: '+92 42 111 2222' },
  websiteUri: 'https://abcplumbing.example',
  storefrontAddress: {
    regionCode: 'PK',
    addressLines: ['12 Main Road'],
    locality: 'Lahore',
    postalCode: '54000',
  },
  regularHours: {
    periods: [
      { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17, minutes: 30 } },
    ],
  },
  profile: { description: 'We clear drains.' },
  openInfo: { status: 'OPEN', openingDate: { year: 2015, month: 3, day: 9 } },
  serviceItems: [
    { freeFormServiceItem: { label: { displayName: 'Drain clearing' } } },
    { structuredServiceItem: { serviceTypeId: 'job_type_id:leak_repair', description: 'Leak repair' } },
  ],
  labels: ['agency-managed'],
  metadata: { hasVoiceOfMerchant: true, mapsUri: 'https://maps.google/x', hasPendingEdits: false },
};

test('the Google location maps onto the editor shape', () => {
  const editable = toEditableProfile(googleLocation, { attributes: [{ name: 'has_wheelchair_access' }] });

  assert.equal(editable.name, 'ABC Plumbing');
  assert.equal(editable.primaryCategory.id, 'gcid:plumber');
  assert.equal(editable.additionalCategories.length, 1);
  assert.equal(editable.phone, '+92 42 111 2222');
  assert.equal(editable.openingDate, '2015-03-09');
  assert.equal(editable.services.length, 2);
  assert.equal(editable.services[1].structuredServiceTypeId, 'job_type_id:leak_repair');
  assert.equal(editable.attributes.length, 1);
  assert.equal(editable.readOnly.verificationStatus, 'VERIFIED');
});

test('hours survive a round trip through the editor shape', () => {
  const days = periodsToDays(googleLocation.regularHours.periods);
  assert.equal(days.length, 7);

  const monday = days.find((day) => day.day === 'MONDAY');
  assert.equal(monday.closed, false);
  assert.deepEqual(monday.ranges, [{ open: '09:00', close: '17:30' }]);

  const tuesday = days.find((day) => day.day === 'TUESDAY');
  assert.equal(tuesday.closed, true);

  const periods = daysToPeriods(days);
  assert.equal(periods.length, 1);
  assert.deepEqual(periods[0].openTime, { hours: 9 });
  assert.deepEqual(periods[0].closeTime, { hours: 17, minutes: 30 });
});

test('each section emits only its own updateMask', () => {
  const { mask, body } = buildSectionPatch('description', 'A longer description of the business.');
  assert.deepEqual(mask, ['profile']);
  assert.deepEqual(body, { profile: { description: 'A longer description of the business.' } });

  // The mask must never widen: that is what silently wipes untouched fields.
  for (const [section, expected] of Object.entries(SECTION_MASKS)) {
    assert.ok(expected.length >= 1, `${section} has no mask`);
  }
});

test('an unknown section is refused rather than sent to Google', () => {
  assert.throws(() => buildSectionPatch('metadata', {}), /not an editable profile section/);
});

test('the categories patch sends resource names, not display labels', () => {
  const { body } = buildSectionPatch('categories', {
    primaryCategory: { id: 'gcid:plumber', label: 'Plumber' },
    additionalCategories: [{ id: 'gcid:drainage_service', label: 'Drainage service' }],
  });
  assert.deepEqual(body.categories.primaryCategory, { name: 'gcid:plumber' });
  assert.deepEqual(body.categories.additionalCategories, [{ name: 'gcid:drainage_service' }]);
});

test('a keyword-stuffed business name is blocked locally', () => {
  const errors = validateSection('name', 'Best Plumber Lahore #1');
  assert.ok(errors.some((message) => message.includes('keyword stuffing')));
});

test('an over-long description and an embedded URL are both flagged', () => {
  const errors = validateSection('description', `${'a'.repeat(760)} https://example.com`);
  assert.equal(errors.length, 2);
});

test('categories require a primary and cap the additional list', () => {
  assert.ok(validateSection('categories', { additionalCategories: [] }).length === 1);
  const tooMany = validateSection('categories', {
    primaryCategory: { id: 'gcid:plumber' },
    additionalCategories: Array.from({ length: 10 }, (_, index) => ({ id: `gcid:${index}` })),
  });
  assert.ok(tooMany.some((message) => message.includes('at most 9')));
});

test('a website URL without a scheme is rejected', () => {
  assert.equal(validateSection('website', 'example.com').length, 1);
  assert.equal(validateSection('website', 'https://example.com').length, 0);
});

test('diffProfiles reports only what actually changed', () => {
  const before = toEditableProfile(googleLocation);
  const after = toEditableProfile({ ...googleLocation, websiteUri: 'https://new.example' });
  assert.deepEqual(diffProfiles(before, after), ['website']);
  assert.deepEqual(diffProfiles(before, before), []);
});

test('a service area business maps without a storefront address', () => {
  const editable = toEditableProfile({
    ...googleLocation,
    storefrontAddress: undefined,
    serviceArea: { businessType: 'CUSTOMER_LOCATION_ONLY', places: { placeInfos: [{ placeId: 'x', placeName: 'Lahore' }] } },
  });
  assert.equal(editable.serviceArea.places.length, 1);
  assert.equal(editable.address.locality, '');
});
