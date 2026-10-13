import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View } from 'react-native';
import { POSProvider, usePOS } from './src/context/POSContext';
import { Header } from './src/components/Header';
import { BottomNav, TabKey } from './src/components/BottomNav';
import { ServerConfigModal } from './src/components/ServerConfigModal';
import { TerminalLockScreen } from './src/components/TerminalLockScreen';
import { TablesScreen } from './src/screens/TablesScreen';
import { OrderScreen } from './src/screens/OrderScreen';
import { KOTsScreen } from './src/screens/KOTsScreen';
import { ShishaScreen } from './src/screens/ShishaScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { COLORS } from './src/constants/theme';

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('tables');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const { setSelectedTable, isLocked } = usePOS();

  const handleSelectTableAndOrder = (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab('order');
  };

  const handleSelectTableAndBill = (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab('order');
  };

  // If terminal is locked, display PIN unlock screen
  if (isLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />
        <TerminalLockScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />

      {/* Top Header */}
      <Header onOpenConfig={() => setActiveTab('settings')} />

      {/* Screen Router */}
      <View style={styles.content}>
        {activeTab === 'tables' && (
          <TablesScreen
            onSelectTableAndOrder={handleSelectTableAndOrder}
            onSelectTableAndBill={handleSelectTableAndBill}
          />
        )}
        {activeTab === 'order' && (
          <OrderScreen onOrderSuccess={() => setActiveTab('kots')} />
        )}
        {activeTab === 'kots' && <KOTsScreen />}
        {activeTab === 'shisha' && <ShishaScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Server Config Modal */}
      <ServerConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <POSProvider>
      <MainApp />
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
});
