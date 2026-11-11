import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  Alert,
  MountainTips,
  TransportKind,
  TransportOption,
} from '../data/mountainTips';
import { PC } from '../screens/Viewpoint';

type Props = {
  tips: MountainTips;
  activeTab: 'transportation' | 'preparation' | 'safety' | 'trail' | 'etiquette' | 'announcements';
  updateTips: (update: (tips: MountainTips) => MountainTips) => void;
};

const TRANSPORT_KINDS: TransportKind[] = [
  'jeepney', 'bus', 'van', 'car', 'tricycle', 'motorcycle', 'boat', 'walk',
];

function GuideInput({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={PC.textFaint}
      multiline={multiline}
      scrollEnabled={false}
      textAlignVertical={multiline ? 'top' : 'center'}
      selectionColor={PC.gold}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, multiline && styles.multiline, focused && styles.inputFocused, style]}
    />
  );
}

function GuidePanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>
          <Ionicons name={icon} size={15} color={PC.gold} />
        </View>
        <View style={styles.panelHeaderText}>
          <Text style={styles.panelTitle}>{title}</Text>
          {subtitle ? <Text style={styles.panelSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.panelContent}>{children}</View>
    </View>
  );
}

function GuideField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  inputStyle,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <GuideInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        style={inputStyle}
      />
    </View>
  );
}

function GuideList({
  label,
  items,
  onChange,
  placeholder,
  icon = 'chevron-forward-outline',
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <GuidePanel title={label} icon={icon}>
      {items.map((item, index) => (
        <View key={`${label}-${index}`} style={styles.listRow}>
          <Ionicons name={icon} size={13} color={PC.gold} style={styles.listIcon} />
          <GuideInput
            value={item}
            onChangeText={(value) => onChange(items.map((entry, itemIndex) => itemIndex === index ? value : entry))}
            placeholder={placeholder}
            multiline
            style={styles.listInput}
          />
          <TouchableOpacity
            onPress={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label} item ${index + 1}`}
          >
            <Ionicons name="close-circle" size={15} color={PC.textFaint} />
          </TouchableOpacity>
        </View>
      ))}
      <AddRow label={`Add ${label.toLowerCase()}`} onPress={() => onChange([...items, ''])} />
    </GuidePanel>
  );
}

type PairRow = { label: string; value: string };

function GuidePairList({
  title,
  rows,
  onChange,
  leftPlaceholder,
  rightPlaceholder,
}: {
  title: string;
  rows: PairRow[];
  onChange: (rows: PairRow[]) => void;
  leftPlaceholder: string;
  rightPlaceholder: string;
}) {
  return (
    <GuidePanel title={title} icon="list-outline">
      {rows.map((row, index) => (
        <View key={`${title}-${index}`} style={styles.pairRow}>
          <GuideInput
            value={row.label}
            onChangeText={(value) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, label: value } : item))}
            placeholder={leftPlaceholder}
            style={styles.pairInput}
          />
          <GuideInput
            value={row.value}
            onChangeText={(value) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item))}
            placeholder={rightPlaceholder}
            style={[styles.pairInput, styles.pairValue]}
          />
          <TouchableOpacity
            onPress={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${title} item ${index + 1}`}
          >
            <Ionicons name="close-circle" size={15} color={PC.textFaint} />
          </TouchableOpacity>
        </View>
      ))}
      <AddRow label={`Add ${title.toLowerCase()}`} onPress={() => onChange([...rows, { label: '', value: '' }])} />
    </GuidePanel>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.addButton}>
      <Ionicons name="add-circle-outline" size={15} color={PC.gold} />
      <Text style={styles.addText}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransportKindDropdown({
  value,
  onChange,
}: {
  value: TransportKind;
  onChange: (kind: TransportKind) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.field, styles.transportTypeField, visible && styles.transportTypeFieldOpen]}>
      <Text style={styles.fieldLabel}>Transport type</Text>
      <TouchableOpacity
        onPress={() => setVisible((current) => !current)}
        activeOpacity={0.75}
        style={styles.dropdownButton}
        accessibilityRole="button"
        accessibilityLabel={`Transport type: ${value}`}
        accessibilityHint="Shows transport type options below"
        accessibilityState={{ expanded: visible }}
      >
        <Text style={styles.dropdownValue}>{value}</Text>
        <Ionicons name={visible ? 'chevron-up' : 'chevron-down'} size={13} color={PC.gold} />
      </TouchableOpacity>
      {visible ? (
        <View style={styles.dropdownMenu}>
          <ScrollView nestedScrollEnabled style={styles.dropdownOptions} showsVerticalScrollIndicator={false}>
            {TRANSPORT_KINDS.map((kind) => {
              const selected = kind === value;
              return (
                <TouchableOpacity
                  key={kind}
                  onPress={() => {
                    onChange(kind);
                    setVisible(false);
                  }}
                  style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextSelected]}>
                    {kind}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={16} color={PC.gold} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function TransportOptions({
  options,
  onChange,
}: {
  options: TransportOption[];
  onChange: (options: TransportOption[]) => void;
}) {
  const patchOption = (index: number, patch: Partial<TransportOption>) => {
    onChange(options.map((option, itemIndex) => itemIndex === index ? { ...option, ...patch } : option));
  };
  return (
    <GuidePanel title="Ways to get there" subtitle="Add a ride, fare, and useful details." icon="bus-outline">
      {options.map((option, index) => (
        <View key={`ride-${index}`} style={styles.itemCard}>
          <View style={styles.itemCardHeader}>
            <Text style={styles.itemNumber}>RIDE {index + 1}</Text>
            <TouchableOpacity
              onPress={() => onChange(options.filter((_, itemIndex) => itemIndex !== index))}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Remove ride ${index + 1}`}
            >
              <Ionicons name="trash-outline" size={14} color="#E07070" />
            </TouchableOpacity>
          </View>
          <GuideField
            label="Ride / destination"
            value={option.vehicle}
            onChangeText={(value) => patchOption(index, { vehicle: value })}
            placeholder="e.g. Jeepney to the jump-off"
          />
          <View style={styles.transportMetaRow}>
            <TransportKindDropdown
              value={option.kind ?? 'car'}
              onChange={(kind) => patchOption(index, { kind })}
            />
            <GuideField
              label="Fare per person"
              value={option.pricePerPerson == null ? '' : String(option.pricePerPerson)}
              onChangeText={(value) => patchOption(index, { pricePerPerson: value || undefined })}
              placeholder="e.g. ₱150"
              style={styles.fareField}
            />
          </View>
          <GuideField
            label="Travel time / schedule"
            value={option.note ?? ''}
            onChangeText={(value) => patchOption(index, { note: value || undefined })}
            placeholder="Add travel time, schedule, or other ride details"
            multiline
            inputStyle={styles.longTextInput}
          />
        </View>
      ))}
      <AddRow
        label="Add transportation option"
        onPress={() => onChange([...options, { vehicle: '', kind: 'car' }])}
      />
    </GuidePanel>
  );
}

export default function MountainGuideEditor({ tips, activeTab, updateTips }: Props) {
  const update = (patch: Partial<MountainTips>) => updateTips((current) => ({ ...current, ...patch }));

  return (
    <View style={styles.content}>
      <View style={styles.hint}>
        <Ionicons name="create-outline" size={13} color={PC.gold} />
        <Text style={styles.hintText}>Edit guide details directly in the cards. Changes are saved with the Save button.</Text>
      </View>

      {activeTab === 'transportation' && (
        <>
          <GuidePanel title="Where to begin" subtitle="The first town, terminal, or jump-off point." icon="location-outline">
            <GuideField
              label="Starting point"
              value={tips.transportGuide?.startPoint ?? ''}
              onChangeText={(value) => update({ transportGuide: { ...(tips.transportGuide ?? { startPoint: '', options: [] }), startPoint: value } })}
              placeholder="Enter the starting point"
              multiline
              inputStyle={styles.longTextInput}
            />
          </GuidePanel>
          <TransportOptions
            options={tips.transportGuide?.options ?? []}
            onChange={(options) => update({ transportGuide: { ...(tips.transportGuide ?? { startPoint: '', options: [] }), options } })}
          />
          <GuideList
            label="Transportation tips"
            items={tips.transportation}
            onChange={(transportation) => update({ transportation })}
            placeholder="Add a transportation tip"
            icon="navigate-outline"
          />
          <GuidePanel title="Travel reminder" icon="alert-circle-outline">
            <GuideField
              label="Note for hikers"
              value={tips.transportGuide?.tip ?? ''}
              onChangeText={(value) => update({ transportGuide: { ...(tips.transportGuide ?? { startPoint: '', options: [] }), tip: value } })}
              placeholder="Add a reminder about fares, schedules, or availability"
              multiline
            />
          </GuidePanel>
        </>
      )}

      {activeTab === 'preparation' && (
        <>
          <GuidePairList
            title="Quick facts"
            rows={(tips.preparationGuide?.facts ?? []).map((item) => ({ label: item.label, value: item.value }))}
            onChange={(facts) => update({ preparationGuide: { ...(tips.preparationGuide ?? {}), facts }})}
            leftPlaceholder="Fact"
            rightPlaceholder="Value"
          />
          <GuidePairList
            title="Permits and fees"
            rows={(tips.preparationGuide?.fees ?? []).map((item) => ({ label: item.label, value: item.amount }))}
            onChange={(rows) => update({ preparationGuide: { ...(tips.preparationGuide ?? {}), fees: rows.map(({ label, value }) => ({ label, amount: value })) } })}
            leftPlaceholder="Permit / fee"
            rightPlaceholder="Amount"
          />
          <GuideList
            label="What to bring"
            items={tips.preparationGuide?.bring ?? []}
            onChange={(bring) => update({ preparationGuide: { ...(tips.preparationGuide ?? {}), bring } })}
            placeholder="Add an item to bring"
            icon="briefcase-outline"
          />
          <GuideList
            label="Preparation tips"
            items={tips.preparation}
            onChange={(preparation) => update({ preparation })}
            placeholder="Add a preparation tip"
            icon="checkmark-circle-outline"
          />
          <GuidePanel title="Preparation note" icon="information-circle-outline">
            <GuideField
              label="Note for hikers"
              value={tips.preparationGuide?.note ?? ''}
              onChangeText={(value) => update({ preparationGuide: { ...(tips.preparationGuide ?? {}), note: value } })}
              placeholder="Add additional preparation guidance"
              multiline
            />
          </GuidePanel>
        </>
      )}

      {activeTab === 'safety' && (
        <>
          <GuidePanel title="Emergency plan" icon="call-outline">
            <GuideField
              label="Emergency and check-in information"
              value={tips.safetyGuide?.emergency ?? ''}
              onChangeText={(value) => update({ safetyGuide: { ...(tips.safetyGuide ?? {}), emergency: value } })}
              placeholder="Add registration, check-in, and emergency details"
              multiline
            />
          </GuidePanel>
          <GuidePanel title="Weather guidance" icon="cloud-outline">
            <GuideField
              label="Weather"
              value={tips.safetyGuide?.weather ?? ''}
              onChangeText={(value) => update({ safetyGuide: { ...(tips.safetyGuide ?? {}), weather: value } })}
              placeholder="Add weather guidance"
              multiline
            />
          </GuidePanel>
          <GuidePairList
            title="Hazards to watch for"
            rows={(tips.safetyGuide?.hazards ?? []).map((item) => ({ label: item.label, value: item.detail ?? '' }))}
            onChange={(rows) => update({ safetyGuide: { ...(tips.safetyGuide ?? {}), hazards: rows.map(({ label, value }) => value ? { label, detail: value } : { label }) } })}
            leftPlaceholder="Hazard"
            rightPlaceholder="Details"
          />
          <GuideList
            label="Safety advisories"
            items={tips.safety}
            onChange={(safety) => update({ safety })}
            placeholder="Add a safety advisory"
            icon="warning-outline"
          />
          <GuidePanel title="Safety note" icon="information-circle-outline">
            <GuideField
              label="Note for hikers"
              value={tips.safetyGuide?.note ?? ''}
              onChangeText={(value) => update({ safetyGuide: { ...(tips.safetyGuide ?? {}), note: value } })}
              placeholder="Add an additional safety note"
              multiline
            />
          </GuidePanel>
        </>
      )}

      {activeTab === 'trail' && (
        <>
          <GuidePanel title="Trail access" icon="trail-sign-outline">
            <GuideField
              label="Where to start"
              value={tips.trailGuide?.startPoint ?? ''}
              onChangeText={(value) => update({ trailGuide: { ...(tips.trailGuide ?? { startPoint: '' }), startPoint: value } })}
              placeholder="Registration, jump-off, or first point"
            />
            <GuideField
              label="Drop-off point"
              value={tips.trailGuide?.dropOff ?? ''}
              onChangeText={(value) => update({ trailGuide: { ...(tips.trailGuide ?? { startPoint: '' }), dropOff: value } })}
              placeholder="Where a vehicle can drop hikers"
            />
          </GuidePanel>
          <GuidePairList
            title="Trail stops"
            rows={(tips.trailGuide?.stops ?? []).map((item) => ({ label: item.label, value: item.detail ?? '' }))}
            onChange={(rows) => update({ trailGuide: { ...(tips.trailGuide ?? { startPoint: '' }), stops: rows.map(({ label, value }) => value ? { label, detail: value } : { label }) } })}
            leftPlaceholder="Place"
            rightPlaceholder="Day, elevation, or time"
          />
          <GuideList
            label="Landmarks"
            items={tips.trailGuide?.landmarks ?? []}
            onChange={(landmarks) => update({ trailGuide: { ...(tips.trailGuide ?? { startPoint: '' }), landmarks } })}
            placeholder="Add a landmark"
            icon="eye-outline"
          />
          <GuidePanel title="Water and trail note" icon="water-outline">
            <GuideField
              label="Water source information"
              value={tips.trailGuide?.water ?? ''}
              onChangeText={(value) => update({ trailGuide: { ...(tips.trailGuide ?? { startPoint: '' }), water: value } })}
              placeholder="Where hikers can find water"
              multiline
            />
            <GuideField
              label="Trail note"
              value={tips.trailGuide?.tip ?? ''}
              onChangeText={(value) => update({ trailGuide: { ...(tips.trailGuide ?? { startPoint: '' }), tip: value } })}
              placeholder="Add a note about the route"
              multiline
            />
          </GuidePanel>
          <GuideList
            label="Trail tips"
            items={tips.trailTips}
            onChange={(trailTips) => update({ trailTips })}
            placeholder="Add a trail tip"
            icon="compass-outline"
          />
        </>
      )}

      {activeTab === 'etiquette' && (
        <>
          <GuidePairList
            title="Mountain rules"
            rows={(tips.etiquetteGuide?.rules ?? []).map((item) => ({ label: item.label, value: item.detail ?? '' }))}
            onChange={(rows) => update({ etiquetteGuide: { ...(tips.etiquetteGuide ?? {}), rules: rows.map(({ label, value }) => value ? { label, detail: value } : { label }) } })}
            leftPlaceholder="Rule"
            rightPlaceholder="Details"
          />
          <GuidePanel title="Local customs" icon="people-outline">
            <GuideField
              label="Community guidance"
              value={tips.etiquetteGuide?.local ?? ''}
              onChangeText={(value) => update({ etiquetteGuide: { ...(tips.etiquetteGuide ?? {}), local: value } })}
              placeholder="Share guidance for respecting local people and places"
              multiline
            />
          </GuidePanel>
          <GuideList
            label="Etiquette tips"
            items={tips.etiquette}
            onChange={(etiquette) => update({ etiquette })}
            placeholder="Add an etiquette tip"
            icon="leaf-outline"
          />
          <GuidePanel title="Etiquette note" icon="information-circle-outline">
            <GuideField
              label="Note for hikers"
              value={tips.etiquetteGuide?.note ?? ''}
              onChangeText={(value) => update({ etiquetteGuide: { ...(tips.etiquetteGuide ?? {}), note: value } })}
              placeholder="Add an additional note"
              multiline
            />
          </GuidePanel>
        </>
      )}

      {activeTab === 'announcements' && (
        <GuidePanel title="Official announcements" subtitle="Publish current closures, conditions, and advisories." icon="megaphone-outline">
          {tips.alerts.map((alert, index) => (
            <View key={`alert-${index}`} style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemNumber}>ANNOUNCEMENT {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => update({ alerts: tips.alerts.filter((_, itemIndex) => itemIndex !== index) })}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove announcement ${index + 1}`}
                >
                  <Ionicons name="trash-outline" size={14} color="#E07070" />
                </TouchableOpacity>
              </View>
              <View style={styles.severityRow}>
                {(['info', 'warning', 'danger'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => update({ alerts: tips.alerts.map((item, itemIndex) => itemIndex === index ? { ...item, type } : item) })}
                    style={[styles.severityChip, alert.type === type && (type === 'danger' ? styles.dangerActive : type === 'warning' ? styles.warningActive : styles.infoActive)]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: alert.type === type }}
                  >
                    <Text style={[styles.severityText, alert.type === type && styles.severityTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <GuideField
                label="Title"
                value={alert.title}
                onChangeText={(title) => update({ alerts: tips.alerts.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) })}
                placeholder="Announcement title"
              />
              <GuideField
                label="Message"
                value={alert.message}
                onChangeText={(message) => update({ alerts: tips.alerts.map((item, itemIndex) => itemIndex === index ? { ...item, message } : item) })}
                placeholder="Details for hikers"
                multiline
              />
              <GuideField
                label="Date (optional)"
                value={alert.date ?? ''}
                onChangeText={(date) => update({ alerts: tips.alerts.map((item, itemIndex) => {
                  if (itemIndex !== index) return item;
                  const next: Alert = { ...item };
                  if (date) next.date = date;
                  else delete next.date;
                  return next;
                }) })}
                placeholder="e.g. Nov 11, 2026"
              />
            </View>
          ))}
          <AddRow
            label="Add announcement"
            onPress={() => update({ alerts: [...tips.alerts, { type: 'info', title: '', message: '' }] })}
          />
        </GuidePanel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 10, paddingBottom: 28, gap: 10 },
  hint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
    backgroundColor: 'rgba(201,169,110,0.06)',
  },
  hintText: { flex: 1, color: PC.textFaint, fontSize: 10, lineHeight: 15 },
  panel: {
    padding: 12, borderRadius: 13, borderWidth: 1, borderColor: PC.border,
    backgroundColor: PC.bgPanel,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  panelIcon: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
  },
  panelHeaderText: { flex: 1 },
  panelTitle: { color: PC.textPrimary, fontSize: 12, fontWeight: '800' },
  panelSubtitle: { color: PC.textFaint, fontSize: 9, lineHeight: 13, marginTop: 2 },
  panelContent: { gap: 10 },
  field: { gap: 5, flex: 1 },
  fieldLabel: { color: PC.textFaint, fontSize: 8, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    minHeight: 34, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.36)',
    backgroundColor: 'rgba(201,169,110,0.07)', color: PC.textPrimary, fontSize: 11,
  },
  multiline: { minHeight: 54, lineHeight: 16, textAlignVertical: 'top' },
  longTextInput: { minHeight: 82, lineHeight: 18 },
  inputFocused: { borderColor: PC.gold, backgroundColor: 'rgba(201,169,110,0.12)' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  listIcon: { marginTop: 1 },
  listInput: { flex: 1, minWidth: 0 },
  pairRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingVertical: 3 },
  pairInput: { flex: 1, minWidth: 0 },
  pairValue: { flex: 1.2 },
  pairField: { flex: 1, minWidth: 0 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5,
    paddingHorizontal: 4, paddingVertical: 3, marginTop: 2,
  },
  addText: { color: PC.gold, fontSize: 9, fontWeight: '700' },
  itemCard: {
    gap: 9, padding: 10, borderRadius: 10, borderWidth: 1,
    borderColor: PC.borderSubtle, backgroundColor: PC.bgCard,
  },
  itemCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemNumber: { color: PC.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  transportMetaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  transportTypeField: { flex: 0, width: 132, position: 'relative' },
  transportTypeFieldOpen: { zIndex: 10, elevation: 10 },
  fareField: { flex: 1.15 },
  dropdownButton: {
    minHeight: 32, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.36)',
    backgroundColor: 'rgba(201,169,110,0.07)', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 6,
  },
  dropdownValue: { color: PC.textPrimary, fontSize: 11, textTransform: 'capitalize' },
  dropdownMenu: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, elevation: 10,
    marginTop: 4, padding: 3, borderRadius: 8, borderWidth: 1,
    borderColor: PC.border, backgroundColor: PC.bgPanel,
  },
  dropdownOptions: { maxHeight: 144 },
  dropdownOption: {
    minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 7, borderRadius: 6,
  },
  dropdownOptionSelected: { backgroundColor: 'rgba(201,169,110,0.1)' },
  dropdownOptionText: { color: PC.textPrimary, fontSize: 10, textTransform: 'capitalize' },
  dropdownOptionTextSelected: { color: PC.gold, fontWeight: '700' },
  severityRow: { flexDirection: 'row', gap: 6 },
  severityChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: PC.borderSubtle },
  infoActive: { backgroundColor: 'rgba(94,159,209,0.12)', borderColor: '#5E9FD1' },
  warningActive: { backgroundColor: 'rgba(201,169,110,0.12)', borderColor: PC.gold },
  dangerActive: { backgroundColor: 'rgba(224,112,112,0.12)', borderColor: '#E07070' },
  severityText: { color: PC.textFaint, fontSize: 9, textTransform: 'capitalize' },
  severityTextActive: { color: PC.textPrimary, fontWeight: '700' },
});
