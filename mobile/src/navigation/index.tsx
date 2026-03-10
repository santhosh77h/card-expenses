import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import Constants from 'expo-constants';
import { colors } from '../theme';
import { setPostHogClient } from '../utils/analytics';
import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import UploadScreen from '../screens/UploadScreen';
import CardsScreen from '../screens/CardsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import BackupScreen from '../screens/BackupScreen';
import CardListScreen from '../screens/CardListScreen';
import EditCardScreen from '../screens/EditCardScreen';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Analysis: { statementId: string; cardId: string };
  AddTransaction: undefined;
  Backup: undefined;
  CardList: undefined;
  EditCard: { cardId: string };
};

export type TabParamList = {
  Home: undefined;
  Transactions: undefined;
  Upload: undefined;
  You: undefined;
  Cards: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const darkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' as const },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = 'home';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Transactions') iconName = 'list';
          else if (route.name === 'Upload') iconName = 'upload';
          else if (route.name === 'Cards') iconName = 'credit-card';
          else if (route.name === 'You') iconName = 'user';
          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Cards" component={CardsScreen} />
      <Tab.Screen name="You" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function PostHogClientCapture() {
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog) {
      console.log('[PostHog] Client initialized successfully');
      setPostHogClient(posthog);
    }
  }, [posthog]);
  return null;
}

const posthogApiKey = Constants.expoConfig?.extra?.posthogApiKey as string | undefined;
const posthogHost = Constants.expoConfig?.extra?.posthogHost as string | undefined;

if (__DEV__) {
  console.log('[PostHog] API key present:', !!posthogApiKey);
  console.log('[PostHog] Host:', posthogHost);
}

export default function Navigation() {
  const navigator = (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          headerShown: true,
          headerTitle: 'Add Transaction',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Analysis"
        component={AnalysisScreen}
        options={{
          headerShown: true,
          headerTitle: 'Statement Analysis',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Backup"
        component={BackupScreen}
        options={{
          headerShown: true,
          headerTitle: 'Data & Backup',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="CardList"
        component={CardListScreen}
        options={{
          headerShown: true,
          headerTitle: 'My Cards',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="EditCard"
        component={EditCardScreen}
        options={{
          headerShown: true,
          headerTitle: 'Edit Card',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );

  return (
    <NavigationContainer theme={darkTheme}>
      {posthogApiKey ? (
        <PostHogProvider
          apiKey={posthogApiKey}
          options={{ host: posthogHost, flushAt: 1, flushInterval: 0 }}
          debug={__DEV__}
          autocapture={{ captureScreens: true }}
        >
          <PostHogClientCapture />
          {navigator}
        </PostHogProvider>
      ) : (
        navigator
      )}
    </NavigationContainer>
  );
}
