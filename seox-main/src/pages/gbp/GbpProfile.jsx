import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  Field,
  LocationPicker,
  NoLocation,
  NoProject,
  Notice,
  Spinner,
  card,
  inputClass,
  useGbpLocation,
} from './gbpUi.jsx';
import {
  getGbpAttributeMetadata,
  getGbpProfile,
  rollbackGbpProfile,
  saveGbpAttributes,
  saveGbpSection,
  searchGbpCategories,
} from '../../lib/gbpApi.js';

const DAY_LABELS = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

const SECTIONS = [
  { key: 'name', label: 'Business name' },
  { key: 'categories', label: 'Categories' },
  { key: 'description', label: 'Description' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'address', label: 'Address' },
  { key: 'regularHours', label: 'Regular hours' },
  { key: 'specialHours', label: 'Holiday hours' },
  { key: 'services', label: 'Services' },
  { key: 'openingDate', label: 'Opening date' },
  { key: 'labels', label: 'Labels' },
  { key: 'storeCode', label: 'Store code' },
  { key: 'serviceArea', label: 'Service area' },
  { key: 'moreHours', label: 'Additional hours' },
];

// Google's own hours types. hoursTypeId is validated by the API, so an unknown
// value is rejected rather than silently ignored.
const MORE_HOURS_TYPES = [
  { id: 'DELIVERY', label: 'Delivery' },
  { id: 'TAKEOUT', label: 'Takeaway' },
  { id: 'PICKUP', label: 'Pickup' },
  { id: 'DRIVE_THROUGH', label: 'Drive through' },
  { id: 'HAPPY_HOUR', label: 'Happy hour' },
  { id: 'ONLINE_SERVICE_HOURS', label: 'Online service' },
  { id: 'SENIOR_HOURS', label: 'Senior hours' },
];

const SERVICE_AREA_TYPES = [
  { id: 'CUSTOMER_LOCATION_ONLY', label: 'Visits customers only (no storefront)' },
  { id: 'CUSTOMER_AND_BUSINESS_LOCATION', label: 'Storefront and visits customers' },
];

function Section({ section, dirty, saving, onSave, onReset, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${card} p-0 overflow-hidden`}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {section.label}
          {dirty ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Unsaved
            </span>
          ) : null}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/30 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="border-t border-white/[0.06] px-5 py-4">
          {children}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save to Google
            </button>
            {dirty ? (
              <button
                onClick={onReset}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05]"
              >
                Discard
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GbpProfile() {
  const {
    projectId,
    locations,
    locationRowId,
    setLocationRowId,
    loadingLocations,
  } = useGbpLocation();

  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [attributesError, setAttributesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [saved, setSaved] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryResults, setCategoryResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [attributeMeta, setAttributeMeta] = useState(null);
  const [attributeDraft, setAttributeDraft] = useState({});

  const load = useCallback(async () => {
    if (!projectId || !locationRowId) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await getGbpProfile({ projectId, locationRowId });
      setProfile(data.profile);
      setDraft(structuredClone(data.profile));
      setSnapshots(data.snapshots || []);
      setAttributesError(data.attributesError || '');
      setAttributeDraft(
        Object.fromEntries((data.profile.attributes || []).map((a) => [a.name, a.values]))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, locationRowId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const isDirty = (section) => {
    if (!profile || !draft) return false;
    const keys = {
      name: ['name'],
      storeCode: ['storeCode'],
      categories: ['primaryCategory', 'additionalCategories'],
      phone: ['phone', 'additionalPhones'],
      website: ['website'],
      address: ['address'],
      regularHours: ['regularHours'],
      specialHours: ['specialHours'],
      description: ['description'],
      openingDate: ['openingDate'],
      services: ['services'],
      labels: ['labels'],
      serviceArea: ['serviceArea'],
      moreHours: ['moreHours'],
    }[section];
    return (keys || []).some(
      (key) => JSON.stringify(profile[key] ?? null) !== JSON.stringify(draft[key] ?? null)
    );
  };

  const valueFor = (section) => {
    switch (section) {
      case 'name':
        return draft.name;
      case 'storeCode':
        return draft.storeCode;
      case 'categories':
        return {
          primaryCategory: draft.primaryCategory,
          additionalCategories: draft.additionalCategories,
        };
      case 'phone':
        return { primary: draft.phone, additional: draft.additionalPhones };
      case 'website':
        return draft.website;
      case 'address':
        return draft.address;
      case 'regularHours':
        return draft.regularHours;
      case 'specialHours':
        return draft.specialHours;
      case 'description':
        return draft.description;
      case 'openingDate':
        return draft.openingDate;
      case 'services':
        return draft.services;
      case 'labels':
        return draft.labels;
      case 'serviceArea':
        return draft.serviceArea;
      case 'moreHours':
        return draft.moreHours;
      default:
        return null;
    }
  };

  const handleSave = async (section) => {
    setSaving(section);
    setError('');
    setValidationErrors([]);
    setSaved('');
    try {
      const result = await saveGbpSection({
        projectId,
        locationRowId,
        section,
        value: valueFor(section),
      });
      setProfile(result.profile);
      setDraft(structuredClone(result.profile));
      setSaved(`${section} saved to Google.`);
      await load();
    } catch (err) {
      if (err.payload?.validationErrors) setValidationErrors(err.payload.validationErrors);
      else setError(err.message);
    } finally {
      setSaving('');
    }
  };

  const handleRollback = async (snapshotId) => {
    setSaving(`rollback:${snapshotId}`);
    setError('');
    try {
      const result = await rollbackGbpProfile({ projectId, locationRowId, snapshotId });
      setProfile(result.profile);
      setDraft(structuredClone(result.profile));
      setSaved(`Restored: ${result.restored.join(', ')}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  };

  const handleLoadAttributes = async () => {
    setSaving('attributes:meta');
    setError('');
    try {
      const data = await getGbpAttributeMetadata({ projectId, locationRowId });
      setAttributeMeta(data.attributeMetadata || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  };

  const handleSaveAttributes = async () => {
    setSaving('attributes:save');
    setError('');
    setSaved('');
    try {
      // Only booleans are editable here. Google's other value types (URL, enum,
      // repeated enum) need their own inputs, so they are left alone rather
      // than written with a guessed shape.
      const payload = (attributeMeta || [])
        .filter((meta) => meta.valueType === 'BOOL' && attributeDraft[meta.parent] !== undefined)
        .map((meta) => ({
          name: meta.parent,
          valueType: 'BOOL',
          values: [Boolean(attributeDraft[meta.parent]?.[0] ?? attributeDraft[meta.parent])],
        }));
      if (!payload.length) {
        setError('Nothing to save. Toggle at least one attribute first.');
        return;
      }
      await saveGbpAttributes({ projectId, locationRowId, attributes: payload });
      setSaved(`${payload.length} attributes saved to Google.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  };

  const handleCategorySearch = async () => {
    try {
      const data = await searchGbpCategories({ projectId, locationRowId, q: categoryQuery });
      setCategoryResults(data.categories || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const patch = (changes) => setDraft((current) => ({ ...current, ...changes }));

  if (!projectId) return <NoProject />;
  if (loadingLocations || loading) return <Spinner label="Loading profile from Google…" />;
  if (!locations.length) return <NoLocation />;
  if (error && !draft) {
    return (
      <div className={card}>
        <Notice tone="error" title="Could not load the profile">{error}</Notice>
      </div>
    );
  }
  if (!draft) return <NoLocation />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Profile Manager</h1>
          <p className="mt-1 text-sm text-white/45">
            Every save writes only the section you changed, and stores a snapshot first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationPicker locations={locations} value={locationRowId} onChange={setLocationRowId} />
          <button
            onClick={() => setShowHistory((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/65 transition hover:bg-white/[0.05]"
          >
            <History className="h-4 w-4" />
            History
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title="Google rejected the change">{error}</Notice> : null}
      {validationErrors.length ? (
        <Notice tone="warn" title="Not sent to Google">
          <ul className="list-disc space-y-0.5 pl-5">
            {validationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {saved ? <Notice tone="success" title={saved} /> : null}
      {draft.readOnly?.hasPendingEdits ? (
        <Notice tone="warn" title="Google has a pending suggested edit on this listing">
          Review it in Business Profile Manager — a pending edit can overwrite what you save here.
        </Notice>
      ) : null}
      {attributesError ? (
        <Notice tone="warn" title="Attributes could not be read">{attributesError}</Notice>
      ) : null}

      {showHistory ? (
        <div className={card}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4 text-teal-400" />
            Change history
          </h2>
          {snapshots.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">No snapshots recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {snapshots.map((snapshot) => {
                const fields = snapshot.changed_fields
                  ? typeof snapshot.changed_fields === 'string'
                    ? JSON.parse(snapshot.changed_fields)
                    : snapshot.changed_fields
                  : [];
                return (
                  <li key={snapshot.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/60">
                      {snapshot.source}
                    </span>
                    <span className="text-white/50">{new Date(snapshot.created_at).toLocaleString()}</span>
                    <span className="min-w-0 flex-1 truncate text-white/40">
                      {fields.length ? fields.join(', ') : '—'}
                      {snapshot.changed_by ? ` · ${snapshot.changed_by}` : ''}
                    </span>
                    {snapshot.source === 'pre-edit' && fields.length ? (
                      <button
                        onClick={() => handleRollback(snapshot.id)}
                        disabled={saving === `rollback:${snapshot.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/65 transition hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        {saving === `rollback:${snapshot.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Restore
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* Name */}
      <Section
        section={SECTIONS[0]}
        dirty={isDirty('name')}
        saving={saving === 'name'}
        onSave={() => handleSave('name')}
        onReset={() => patch({ name: profile.name })}
        defaultOpen
      >
        <Field label="Business name" hint="Must match the real-world name. Keywords here get listings suspended.">
          <input
            className={inputClass}
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>
      </Section>

      {/* Categories */}
      <Section
        section={SECTIONS[1]}
        dirty={isDirty('categories')}
        saving={saving === 'categories'}
        onSave={() => handleSave('categories')}
        onReset={() =>
          patch({
            primaryCategory: profile.primaryCategory,
            additionalCategories: profile.additionalCategories,
          })
        }
      >
        <div className="space-y-4">
          <Field label="Primary category">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              {draft.primaryCategory?.label || <span className="text-white/30">Not set</span>}
            </div>
          </Field>

          <Field label="Additional categories" hint="Two to five that match services you actually offer.">
            <div className="flex flex-wrap gap-1.5">
              {draft.additionalCategories.map((category) => (
                <span
                  key={category.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs"
                >
                  {category.label}
                  <button
                    onClick={() =>
                      patch({
                        additionalCategories: draft.additionalCategories.filter(
                          (item) => item.id !== category.id
                        ),
                      })
                    }
                    className="text-white/35 hover:text-rose-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {draft.additionalCategories.length === 0 ? (
                <span className="text-xs text-white/30">None</span>
              ) : null}
            </div>
          </Field>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Search Google categories…"
                value={categoryQuery}
                onChange={(event) => setCategoryQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleCategorySearch()}
              />
              <button
                onClick={handleCategorySearch}
                className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[0.1]"
              >
                Search
              </button>
            </div>
            {categoryResults.length ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto no-scrollbar">
                {categoryResults.map((category) => (
                  <li key={category.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-white/70">{category.label}</span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => patch({ primaryCategory: category })}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/10"
                      >
                        Primary
                      </button>
                      <button
                        onClick={() =>
                          patch({
                            additionalCategories: [
                              ...draft.additionalCategories.filter((item) => item.id !== category.id),
                              category,
                            ],
                          })
                        }
                        className="rounded px-2 py-1 text-[11px] font-semibold text-white/55 hover:bg-white/[0.06]"
                      >
                        Add
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Description */}
      <Section
        section={SECTIONS[2]}
        dirty={isDirty('description')}
        saving={saving === 'description'}
        onSave={() => handleSave('description')}
        onReset={() => patch({ description: profile.description })}
      >
        <Field
          label="Business description"
          hint={`${draft.description.length} / 750 characters. URLs are stripped by Google.`}
        >
          <textarea
            rows={6}
            className={inputClass}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>
      </Section>

      {/* Phone */}
      <Section
        section={SECTIONS[3]}
        dirty={isDirty('phone')}
        saving={saving === 'phone'}
        onSave={() => handleSave('phone')}
        onReset={() => patch({ phone: profile.phone, additionalPhones: profile.additionalPhones })}
      >
        <Field label="Primary phone">
          <input
            className={inputClass}
            value={draft.phone}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </Field>
      </Section>

      {/* Website */}
      <Section
        section={SECTIONS[4]}
        dirty={isDirty('website')}
        saving={saving === 'website'}
        onSave={() => handleSave('website')}
        onReset={() => patch({ website: profile.website })}
      >
        <Field label="Website URL">
          <input
            className={inputClass}
            value={draft.website}
            onChange={(event) => patch({ website: event.target.value })}
          />
        </Field>
      </Section>

      {/* Address */}
      <Section
        section={SECTIONS[5]}
        dirty={isDirty('address')}
        saving={saving === 'address'}
        onSave={() => handleSave('address')}
        onReset={() => patch({ address: profile.address })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address lines">
            <textarea
              rows={2}
              className={inputClass}
              value={draft.address.addressLines.join('\n')}
              onChange={(event) =>
                patch({
                  address: { ...draft.address, addressLines: event.target.value.split('\n') },
                })
              }
            />
          </Field>
          <Field label="Locality (city)">
            <input
              className={inputClass}
              value={draft.address.locality}
              onChange={(event) => patch({ address: { ...draft.address, locality: event.target.value } })}
            />
          </Field>
          <Field label="Administrative area">
            <input
              className={inputClass}
              value={draft.address.administrativeArea}
              onChange={(event) =>
                patch({ address: { ...draft.address, administrativeArea: event.target.value } })
              }
            />
          </Field>
          <Field label="Postal code">
            <input
              className={inputClass}
              value={draft.address.postalCode}
              onChange={(event) => patch({ address: { ...draft.address, postalCode: event.target.value } })}
            />
          </Field>
        </div>
      </Section>

      {/* Regular hours */}
      <Section
        section={SECTIONS[6]}
        dirty={isDirty('regularHours')}
        saving={saving === 'regularHours'}
        onSave={() => handleSave('regularHours')}
        onReset={() => patch({ regularHours: profile.regularHours })}
      >
        <div className="space-y-2">
          {draft.regularHours.map((day, index) => (
            <div key={day.day} className="flex flex-wrap items-center gap-3">
              <span className="w-12 text-sm font-medium text-white/60">{DAY_LABELS[day.day]}</span>
              <label className="flex items-center gap-1.5 text-xs text-white/45">
                <input
                  type="checkbox"
                  checked={!day.closed}
                  onChange={(event) => {
                    const next = structuredClone(draft.regularHours);
                    next[index].closed = !event.target.checked;
                    if (event.target.checked && !next[index].ranges.length) {
                      next[index].ranges = [{ open: '09:00', close: '17:00' }];
                    }
                    patch({ regularHours: next });
                  }}
                  className="h-3.5 w-3.5 accent-brand-500"
                />
                Open
              </label>
              {!day.closed
                ? day.ranges.map((range, rangeIndex) => (
                    <div key={rangeIndex} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={range.open}
                        onChange={(event) => {
                          const next = structuredClone(draft.regularHours);
                          next[index].ranges[rangeIndex].open = event.target.value;
                          patch({ regularHours: next });
                        }}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
                      />
                      <span className="text-white/25">–</span>
                      <input
                        type="time"
                        value={range.close}
                        onChange={(event) => {
                          const next = structuredClone(draft.regularHours);
                          next[index].ranges[rangeIndex].close = event.target.value;
                          patch({ regularHours: next });
                        }}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
                      />
                      <button
                        onClick={() => {
                          const next = structuredClone(draft.regularHours);
                          next[index].ranges.splice(rangeIndex, 1);
                          if (!next[index].ranges.length) next[index].closed = true;
                          patch({ regularHours: next });
                        }}
                        className="text-white/25 hover:text-rose-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                : <span className="text-xs text-white/30">Closed</span>}
              {!day.closed ? (
                <button
                  onClick={() => {
                    const next = structuredClone(draft.regularHours);
                    next[index].ranges.push({ open: '09:00', close: '17:00' });
                    patch({ regularHours: next });
                  }}
                  className="text-white/30 hover:text-teal-300"
                  title="Add a split shift"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      {/* Holiday hours */}
      <Section
        section={SECTIONS[7]}
        dirty={isDirty('specialHours')}
        saving={saving === 'specialHours'}
        onSave={() => handleSave('specialHours')}
        onReset={() => patch({ specialHours: profile.specialHours })}
      >
        <div className="space-y-2">
          {draft.specialHours.map((period, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={period.startDate || ''}
                onChange={(event) => {
                  const next = structuredClone(draft.specialHours);
                  next[index].startDate = event.target.value;
                  next[index].endDate = event.target.value;
                  patch({ specialHours: next });
                }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-white"
              />
              <label className="flex items-center gap-1.5 text-xs text-white/45">
                <input
                  type="checkbox"
                  checked={period.closed}
                  onChange={(event) => {
                    const next = structuredClone(draft.specialHours);
                    next[index].closed = event.target.checked;
                    patch({ specialHours: next });
                  }}
                  className="h-3.5 w-3.5 accent-brand-500"
                />
                Closed
              </label>
              {!period.closed ? (
                <>
                  <input
                    type="time"
                    value={period.open || '09:00'}
                    onChange={(event) => {
                      const next = structuredClone(draft.specialHours);
                      next[index].open = event.target.value;
                      patch({ specialHours: next });
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="time"
                    value={period.close || '17:00'}
                    onChange={(event) => {
                      const next = structuredClone(draft.specialHours);
                      next[index].close = event.target.value;
                      patch({ specialHours: next });
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
                  />
                </>
              ) : null}
              <button
                onClick={() =>
                  patch({ specialHours: draft.specialHours.filter((_, i) => i !== index) })
                }
                className="text-white/25 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              patch({
                specialHours: [
                  ...draft.specialHours,
                  { startDate: '', endDate: '', closed: true, open: null, close: null },
                ],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/[0.05]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add holiday
          </button>
        </div>
      </Section>

      {/* Services */}
      <Section
        section={SECTIONS[8]}
        dirty={isDirty('services')}
        saving={saving === 'services'}
        onSave={() => handleSave('services')}
        onReset={() => patch({ services: profile.services })}
      >
        <div className="space-y-2">
          {draft.services.map((service, index) => (
            <div key={index} className="flex flex-wrap items-start gap-2">
              <input
                className={`${inputClass} max-w-xs`}
                placeholder="Service name"
                value={service.label || service.description || ''}
                onChange={(event) => {
                  const next = structuredClone(draft.services);
                  if (next[index].structuredServiceTypeId) next[index].description = event.target.value;
                  else next[index].label = event.target.value;
                  patch({ services: next });
                }}
              />
              {service.structuredServiceTypeId ? (
                <span className="mt-2 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                  Google service type
                </span>
              ) : null}
              <button
                onClick={() => patch({ services: draft.services.filter((_, i) => i !== index) })}
                className="mt-2 text-white/25 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              patch({ services: [...draft.services, { label: '', description: '', structuredServiceTypeId: null }] })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/[0.05]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add service
          </button>
        </div>
      </Section>

      {/* Opening date */}
      <Section
        section={SECTIONS[9]}
        dirty={isDirty('openingDate')}
        saving={saving === 'openingDate'}
        onSave={() => handleSave('openingDate')}
        onReset={() => patch({ openingDate: profile.openingDate })}
      >
        <Field label="Opening date">
          <input
            type="date"
            className={inputClass}
            value={draft.openingDate || ''}
            onChange={(event) => patch({ openingDate: event.target.value })}
          />
        </Field>
      </Section>

      {/* Labels */}
      <Section
        section={SECTIONS[10]}
        dirty={isDirty('labels')}
        saving={saving === 'labels'}
        onSave={() => handleSave('labels')}
        onReset={() => patch({ labels: profile.labels })}
      >
        <Field label="Labels" hint="Internal only — never shown to customers. Max 10.">
          <textarea
            rows={3}
            className={inputClass}
            value={draft.labels.join('\n')}
            onChange={(event) => patch({ labels: event.target.value.split('\n').filter(Boolean) })}
          />
        </Field>
      </Section>

      {/* Store code */}
      <Section
        section={SECTIONS[11]}
        dirty={isDirty('storeCode')}
        saving={saving === 'storeCode'}
        onSave={() => handleSave('storeCode')}
        onReset={() => patch({ storeCode: profile.storeCode })}
      >
        <Field label="Store code">
          <input
            className={inputClass}
            value={draft.storeCode}
            onChange={(event) => patch({ storeCode: event.target.value })}
          />
        </Field>
      </Section>

      {/* Service area */}
      <Section
        section={SECTIONS[12]}
        dirty={isDirty('serviceArea')}
        saving={saving === 'serviceArea'}
        onSave={() => handleSave('serviceArea')}
        onReset={() => patch({ serviceArea: profile.serviceArea })}
      >
        <div className="space-y-4">
          <Field label="Business type">
            <select
              className={inputClass}
              value={draft.serviceArea?.businessType || ''}
              onChange={(event) =>
                patch({
                  serviceArea: { ...draft.serviceArea, businessType: event.target.value || null },
                })
              }
            >
              <option value="">Not a service area business</option>
              {SERVICE_AREA_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Areas served"
            hint="Places already on the listing. Adding a new one needs a Google place ID, which this picker does not fetch yet."
          >
            <div className="space-y-1.5">
              {(draft.serviceArea?.places || []).map((place) => (
                <div
                  key={place.placeId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="truncate text-white/70">{place.placeName || place.placeId}</span>
                  <button
                    onClick={() =>
                      patch({
                        serviceArea: {
                          ...draft.serviceArea,
                          places: draft.serviceArea.places.filter(
                            (item) => item.placeId !== place.placeId
                          ),
                        },
                      })
                    }
                    className="shrink-0 text-white/30 hover:text-rose-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {(draft.serviceArea?.places || []).length === 0 ? (
                <p className="text-xs text-white/30">No service areas set.</p>
              ) : null}
            </div>
          </Field>
        </div>
      </Section>

      {/* Additional hours */}
      <Section
        section={SECTIONS[13]}
        dirty={isDirty('moreHours')}
        saving={saving === 'moreHours'}
        onSave={() => handleSave('moreHours')}
        onReset={() => patch({ moreHours: profile.moreHours })}
      >
        <div className="space-y-4">
          {(draft.moreHours || []).map((entry, entryIndex) => (
            <div key={entryIndex} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  className={`${inputClass} max-w-[220px]`}
                  value={entry.hoursTypeId}
                  onChange={(event) => {
                    const next = structuredClone(draft.moreHours);
                    next[entryIndex].hoursTypeId = event.target.value;
                    patch({ moreHours: next });
                  }}
                >
                  {MORE_HOURS_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    patch({ moreHours: draft.moreHours.filter((_, i) => i !== entryIndex) })
                  }
                  className="text-white/30 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {entry.days.map((day, dayIndex) => (
                  <div key={day.day} className="flex flex-wrap items-center gap-2.5">
                    <span className="w-12 text-xs font-medium text-white/55">
                      {DAY_LABELS[day.day]}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-white/45">
                      <input
                        type="checkbox"
                        checked={!day.closed}
                        onChange={(event) => {
                          const next = structuredClone(draft.moreHours);
                          next[entryIndex].days[dayIndex].closed = !event.target.checked;
                          if (event.target.checked && !next[entryIndex].days[dayIndex].ranges.length) {
                            next[entryIndex].days[dayIndex].ranges = [
                              { open: '09:00', close: '17:00' },
                            ];
                          }
                          patch({ moreHours: next });
                        }}
                        className="h-3.5 w-3.5 accent-brand-500"
                      />
                      Open
                    </label>
                    {!day.closed ? (
                      day.ranges.map((range, rangeIndex) => (
                        <div key={rangeIndex} className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={range.open}
                            onChange={(event) => {
                              const next = structuredClone(draft.moreHours);
                              next[entryIndex].days[dayIndex].ranges[rangeIndex].open =
                                event.target.value;
                              patch({ moreHours: next });
                            }}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
                          />
                          <span className="text-white/25">–</span>
                          <input
                            type="time"
                            value={range.close}
                            onChange={(event) => {
                              const next = structuredClone(draft.moreHours);
                              next[entryIndex].days[dayIndex].ranges[rangeIndex].close =
                                event.target.value;
                              patch({ moreHours: next });
                            }}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white"
                          />
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-white/30">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() =>
              patch({
                moreHours: [
                  ...(draft.moreHours || []),
                  {
                    hoursTypeId: 'DELIVERY',
                    days: Object.keys(DAY_LABELS).map((day) => ({
                      day,
                      closed: true,
                      ranges: [],
                    })),
                  },
                ],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/[0.05]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add hours type
          </button>
        </div>
      </Section>

      {/* Attributes */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4 text-teal-400" />
            Attributes
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">
              {draft.attributes.length} set
            </span>
          </h2>
          {attributeMeta === null ? (
            <button
              onClick={handleLoadAttributes}
              disabled={saving === 'attributes:meta'}
              className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
            >
              {saving === 'attributes:meta' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Load available attributes
            </button>
          ) : (
            <button
              onClick={handleSaveAttributes}
              disabled={saving === 'attributes:save'}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {saving === 'attributes:save' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save attributes
            </button>
          )}
        </div>

        {attributeMeta === null ? (
          <p className="mt-2 text-sm text-white/45">
            Attribute sets are specific to the primary category and country, so the list is fetched
            from Google rather than hard-coded.
          </p>
        ) : attributeMeta.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">
            Google offers no attributes for this category and country.
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-1.5">
              {attributeMeta
                .filter((meta) => meta.valueType === 'BOOL')
                .map((meta) => (
                  <li key={meta.parent}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        checked={Boolean(attributeDraft[meta.parent]?.[0])}
                        onChange={(event) =>
                          setAttributeDraft((current) => ({
                            ...current,
                            [meta.parent]: [event.target.checked],
                          }))
                        }
                        className="h-4 w-4 accent-brand-500"
                      />
                      <span className="text-white/70">{meta.displayName || meta.parent}</span>
                      {meta.groupDisplayName ? (
                        <span className="text-[11px] text-white/30">{meta.groupDisplayName}</span>
                      ) : null}
                    </label>
                  </li>
                ))}
            </ul>

            {attributeMeta.some((meta) => meta.valueType !== 'BOOL') ? (
              <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/30">
                {attributeMeta.filter((meta) => meta.valueType !== 'BOOL').length} attributes for this
                category use URL, enum or repeated-enum values. They are not editable here yet, and
                are left untouched when the booleans are saved.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
