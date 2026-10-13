import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View } from 'react-native';
import { POSProvider, usePOS } from './src/context/POSContext';
import { Header } from './src/components/Header';
import { BottomNav, TabKey } from './src/components/BottomNav';
import { ServerConfigModal } from './src/components/ServerConfigModal';
import { TablesScreen } from './src/screens/TablesScreen';
import { OrderScreen } from './src/screens/OrderScreen';
import { KOTsScreen } from './src/screens/KOTsScreen';
import { ShishaScreen } from './src/screens/ShishaScreen';
import { COLORS } from './src/constants/theme';

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('tables');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const { setSelectedTable } = usePOS();

  const handleSelectTableAndOrder = (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab('order');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />

      {/* Top Header */}
      <Header onOpenConfig={() => setShowConfigModal(true)} />

      {/* Screen Router */}
      <View style={styles.content}>
        {activeTab === 'tables' && (
          <TablesScreen onSelectTableAndOrder={handleSelectTableAndOrder} />
        )}
        {activeTab === 'order' && (
          <OrderScreen onOrderSuccess={() => setActiveTab('kots')} />
        )}
        {activeTab === 'kots' && <KOTsScreen />}
        {activeTab === 'shisha' && <ShishaScreen />}
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
