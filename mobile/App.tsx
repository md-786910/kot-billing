import React, { useEffect, useState } from 'react';
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
import { MoreScreen, MorePage, MORE_PAGE_TITLES } from './src/screens/MoreScreen';
import { COLORS, SPACE } from './src/constants/theme';
import { Banner } from './src/ui';

const TAB_TITLES: Record<TabKey, string> = {
  tables: 'Tables',
  order: 'Order',
  kots: 'KOTs',
  shisha: 'Shisha',
  more: 'More',
};

// Only mounted while a staff member is signed in, so each sign-in starts on the Tables tab
function MainApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('tables');
  const [morePage, setMorePage] = useState<MorePage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { selectedTable, setSelectedTable } = usePOS();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab('order');
  };

  // Tapping More while it is open goes back to the More list
  const handleTabChange = (tab: TabKey) => {
    if (tab === 'more' && activeTab === 'more') setMorePage(null);
    setActiveTab(tab);
  };

  const headerTitle =
    activeTab === 'order' ? selectedTable : activeTab === 'more' && morePage ? MORE_PAGE_TITLES[morePage] : TAB_TITLES[activeTab];

  // After a KOT is sent the waiter is usually heading to the next table
  const handleOrderSent = (message: string) => {
    setToast(message);
    setActiveTab('tables');
  };

  return (
    <>
      <Header title={headerTitle} />

      <View style={styles.content}>
        {activeTab === 'tables' && <TablesScreen onSelectTable={handleSelectTable} />}
        {activeTab === 'order' && <OrderScreen onOrderSuccess={handleOrderSent} />}
        {activeTab === 'kots' && <KOTsScreen />}
        {activeTab === 'shisha' && <ShishaScreen />}
        {activeTab === 'more' && (
          <MoreScreen page={morePage} onPageChange={setMorePage} onOpenTable={handleSelectTable} />
        )}
        {toast && (
          <View style={styles.toast} pointerEvents="box-none" testID="toast">
            <Banner tone="success" text={toast} />
          </View>
        )}
      </View>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
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
  toast: {
    position: 'absolute',
    left: SPACE.lg,
    right: SPACE.lg,
    bottom: SPACE.lg,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
