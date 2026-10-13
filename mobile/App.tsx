import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View, ActivityIndicator } from 'react-native';
import { POSProvider, usePOS } from './src/context/POSContext';
import { Header } from './src/components/Header';
import { BottomNav, TabKey } from './src/components/BottomNav';
import { PairingScreen } from './src/components/PairingScreen';
import { TerminalLockScreen } from './src/components/TerminalLockScreen';
import { PrivacyCover } from './src/components/PrivacyCover';
import { TablesScreen } from './src/screens/TablesScreen';
import { OrderScreen } from './src/screens/OrderScreen';
import { KOTsScreen } from './src/screens/KOTsScreen';
import { ShishaScreen } from './src/screens/ShishaScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { COLORS } from './src/constants/theme';

// Only mounted while a staff member is signed in, so each sign-in starts on the Tables tab
function MainApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('tables');
  const { setSelectedTable } = usePOS();

  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab('order');
  };

  return (
    <>
      <Header onOpenSettings={() => setActiveTab('settings')} />

      <View style={styles.content}>
        {activeTab === 'tables' && (
          <TablesScreen onSelectTableAndOrder={handleSelectTable} onSelectTableAndBill={handleSelectTable} />
        )}
        {activeTab === 'order' && <OrderScreen onOrderSuccess={() => setActiveTab('kots')} />}
        {activeTab === 'kots' && <KOTsScreen />}
        {activeTab === 'shisha' && <ShishaScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}

function Root() {
  const { authStatus, markActivity } = usePOS();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />
      {/* Every touch resets the inactivity auto-lock timer */}
      <View style={styles.container} onTouchStart={markActivity}>
        {authStatus === 'booting' ? (
          <View style={styles.splash}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : authStatus === 'unpaired' ? (
          <PairingScreen />
        ) : authStatus === 'locked' ? (
          <TerminalLockScreen />
        ) : (
          <MainApp />
        )}
        {/* Hides orders and bills from the iOS app switcher; the app locks once it is in the background */}
        <PrivacyCover />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <POSProvider>
      <Root />
    </POSProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  content: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
