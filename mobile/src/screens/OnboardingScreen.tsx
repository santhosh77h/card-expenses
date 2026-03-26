import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import AppIntroSlider from 'react-native-app-intro-slider';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import type { ThemeMode } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Slide data matching the HTML carousel
// ---------------------------------------------------------------------------

interface Feature {
  text: string;
  dotColor?: string;
}

interface Slide {
  key: string;
  tag: string;
  title: string;
  description: string;
  features: Feature[];
  iconBg: string;
  accentColor: string;
  icon: React.ReactNode;
  showThemePicker?: boolean;
}

const ACCENT = '#00E5A0';
const BG = '#0A0E1A';

const slides: Slide[] = [
  {
    key: 'welcome',
    tag: 'Welcome to Vector',
    title: 'Your finances,\nbeautifully understood',
    description:
      'Upload credit card statements and get instant clarity on where your money goes \u2014 all private, all on-device.',
    features: [
      { text: '7+ banks supported \u2014 HDFC, ICICI, Axis & more' },
      { text: 'No account needed, no cloud, no tracking' },
      { text: 'INR, USD, EUR, GBP \u2014 multi-currency ready' },
    ],
    iconBg: 'rgba(0,229,160,0.08)',
    accentColor: ACCENT,
    icon: (
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <Rect x={6} y={10} width={28} height={20} rx={4} stroke={ACCENT} strokeWidth={1.5} />
        <Path d="M12 20h5M12 24h10M23 20l3 4 4-6" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={30} cy={11} r={5} fill={BG} stroke={ACCENT} strokeWidth={1.5} />
        <Path d="M28 11l1.5 1.5L32 9" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: 'import',
    tag: 'Smart Import',
    title: 'Drop a PDF,\nget instant insights',
    description:
      'Upload one or many statements at once. Vector parses transactions automatically and flags duplicates so nothing slips through.',
    features: [
      { text: 'Password-protected PDFs handled automatically', dotColor: '#5BA4F5' },
      { text: 'SHA-256 duplicate detection on every upload', dotColor: '#5BA4F5' },
      { text: 'Re-upload to see what changed \u2014 added, removed', dotColor: '#5BA4F5' },
    ],
    iconBg: 'rgba(55,138,221,0.1)',
    accentColor: '#5BA4F5',
    icon: (
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <Rect x={8} y={8} width={24} height={16} rx={3} stroke="#5BA4F5" strokeWidth={1.5} />
        <Path d="M8 14h24" stroke="#5BA4F5" strokeWidth={1.5} />
        <Circle cx={12} cy={11} r={1.5} fill="#5BA4F5" />
        <Path d="M13 28h14M13 32h10" stroke="#5BA4F5" strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M20 24v4" stroke="#5BA4F5" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: 'analytics',
    tag: 'Analytics',
    title: 'Charts that actually\ntell a story',
    description:
      'Trend lines, category donuts, merchant rankings, and month-over-month comparisons \u2014 all rendered from your local data.',
    features: [
      { text: '12-month spending trend with average overlay', dotColor: '#C879FF' },
      { text: '12 smart categories auto-assigned to transactions', dotColor: '#C879FF' },
      { text: 'Top merchants ranked by spend & frequency', dotColor: '#C879FF' },
    ],
    iconBg: 'rgba(208,113,255,0.1)',
    accentColor: '#C879FF',
    icon: (
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <Circle cx={20} cy={20} r={12} stroke="#C879FF" strokeWidth={1.5} />
        <Path d="M20 20L20 10" stroke="#C879FF" strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M20 20L27 24" stroke="#C879FF" strokeWidth={2} strokeLinecap="round" />
        <Circle cx={20} cy={20} r={2} fill="#C879FF" />
        <Path d="M9 20h2M29 20h2M20 9v2M20 29v2" stroke="#C879FF" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: 'ask',
    tag: 'Ask Vector',
    title: 'Just ask \u2014 in plain\nEnglish',
    description:
      'Type questions like \u201chow much did I spend on Swiggy last month?\u201d and get instant answers \u2014 no internet, no servers, fully on-device AI.',
    features: [
      { text: '"Total Swiggy spend?" \u2014 instant answer, no typing filters', dotColor: '#FFB93C' },
      { text: 'Spell correction handles typos automatically', dotColor: '#FFB93C' },
      { text: 'Results shown as charts, tables, or summaries', dotColor: '#FFB93C' },
    ],
    iconBg: 'rgba(255,185,60,0.1)',
    accentColor: '#FFB93C',
    icon: (
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <Circle cx={20} cy={18} r={9} stroke="#FFB93C" strokeWidth={1.5} />
        <Path d="M13 28l-4 6M27 28l4 6" stroke="#FFB93C" strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M16 18h8M20 14v8" stroke="#FFB93C" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: 'privacy',
    tag: 'Private & secure',
    title: 'Your data never\nleaves your phone',
    description:
      'Biometric lock, AES-encrypted backups, on-device ML, and local SQLite storage. Vector is designed so only you can see your finances.',
    features: [
      { text: 'Face ID / Touch ID lock screen' },
      { text: 'Encrypted JSON backup with your own password' },
      { text: 'No accounts, no cloud sync, ever' },
    ],
    iconBg: 'rgba(0,229,160,0.1)',
    accentColor: ACCENT,
    showThemePicker: true,
    icon: (
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <Rect x={10} y={8} width={20} height={24} rx={4} stroke={ACCENT} strokeWidth={1.5} />
        <Path d="M15 16h10M15 20h7M15 24h9" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={30} cy={30} r={7} fill={BG} stroke={ACCENT} strokeWidth={1.5} />
        <Path d="M27 30l2 2 4-4" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const sliderRef = useRef<AppIntroSlider<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const setHasSeenOnboarding = useStore((s) => s.setHasSeenOnboarding);
  const themeMode = useStore((s) => s.themeMode);
  const setThemeMode = useStore((s) => s.setThemeMode);

  const isLast = activeIndex === slides.length - 1;

  const handleDone = useCallback(() => {
    setHasSeenOnboarding(true);
    onDone();
  }, [onDone, setHasSeenOnboarding]);

  const handleNext = useCallback(() => {
    if (isLast) {
      handleDone();
    } else {
      sliderRef.current?.goToSlide(activeIndex + 1);
    }
  }, [activeIndex, isLast, handleDone]);

  const handleSkip = useCallback(() => {
    sliderRef.current?.goToSlide(slides.length - 1);
  }, []);

  // Progress bar width
  const progressPct = ((activeIndex + 1) / slides.length) * 100;

  const renderItem = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
        <View style={[styles.iconBorder, { borderColor: item.accentColor + '40' }]} />
        {item.icon}
      </View>

      {/* Tag */}
      <Text style={[styles.tag, { color: item.accentColor }]}>{item.tag}</Text>

      {/* Title */}
      <Text style={styles.title}>{item.title}</Text>

      {/* Description */}
      <Text style={styles.description}>{item.description}</Text>

      {/* Feature pills */}
      <View style={styles.features}>
        {item.features.map((f, i) => (
          <View key={i} style={styles.featurePill}>
            <View style={[styles.featureDot, { backgroundColor: f.dotColor ?? ACCENT }]} />
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Theme picker on last slide */}
      {item.showThemePicker && (
        <View style={styles.themePicker}>
          <Text style={styles.themeLabel}>APPEARANCE</Text>
          <View style={styles.themeOptions}>
            {([
              { mode: 'light' as ThemeMode, icon: 'sun' as const, label: 'Light' },
              { mode: 'dark' as ThemeMode, icon: 'moon' as const, label: 'Dark' },
              { mode: 'system' as ThemeMode, icon: 'smartphone' as const, label: 'Auto' },
            ]).map(({ mode, icon, label }) => {
              const isActive = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.themeOption, isActive && styles.themeOptionActive]}
                  onPress={() => setThemeMode(mode)}
                  activeOpacity={0.7}
                >
                  <Feather name={icon} size={16} color={isActive ? ACCENT : 'rgba(180,195,230,0.5)'} />
                  <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
      </View>

      {/* Slider */}
      <AppIntroSlider
        ref={sliderRef}
        data={slides}
        renderItem={renderItem}
        onSlideChange={setActiveIndex}
        onDone={handleDone}
        dotStyle={styles.dotHidden}
        activeDotStyle={styles.dotHidden}
        renderNextButton={() => null}
        renderDoneButton={() => null}
        showSkipButton={false}
        scrollEnabled
      />

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.actions}>
          {!isLast && (
            <TouchableOpacity style={styles.btnSkip} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.btnSkipText}>Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btnNext, isLast && styles.btnNextFull]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.btnNextText}>{isLast ? 'Get started' : 'Next'}</Text>
            {!isLast && <Feather name="arrow-right" size={16} color={BG} />}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: 2,
    backgroundColor: ACCENT,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  iconBorder: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 23,
    borderWidth: 1,
  },
  tag: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    opacity: 0.85,
  },
  title: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '600',
    color: '#F0F4FF',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(180,195,230,0.8)',
    textAlign: 'center',
    lineHeight: 25,
    maxWidth: 300,
  },
  features: {
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(200,215,240,0.85)',
    fontWeight: '400',
  },
  bottom: {
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: ACCENT,
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotHidden: {
    width: 0,
    height: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 320,
  },
  btnSkip: {
    paddingHorizontal: 20,
    height: 48,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSkipText: {
    fontSize: 14,
    color: 'rgba(180,195,230,0.6)',
  },
  btnNext: {
    flex: 1,
    height: 48,
    backgroundColor: ACCENT,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnNextFull: {
    flex: 1,
  },
  btnNextText: {
    fontSize: 15,
    fontWeight: '600',
    color: BG,
  },
  themePicker: {
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
  },
  themeLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: 'rgba(180,195,230,0.5)',
    marginBottom: 10,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  themeOptionActive: {
    backgroundColor: 'rgba(0,229,160,0.1)',
    borderColor: 'rgba(0,229,160,0.3)',
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(180,195,230,0.5)',
  },
  themeOptionTextActive: {
    color: ACCENT,
  },
});
