import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import UploadScreen from '../screens/UploadScreen';
import AddCardScreen from '../screens/AddCardScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Analysis: { statementId: string; cardId: string };
  AddTransaction: undefined;
};

export type TabParamList = {
  Home: undefined;
  Transactions: undefined;
  Upload: undefined;
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = 'home';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Transactions') iconName = 'list';
          else if (route.name === 'Upload') iconName = 'upload';
          else if (route.name === 'Cards') iconName = 'credit-card';
          return <Feather name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Cards" component={AddCardScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  return (
    <NavigationContainer theme={darkTheme}>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
