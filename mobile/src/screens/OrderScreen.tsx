import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { MenuItemCard } from '../components/MenuItemCard';
import { StickyCartBar } from '../components/StickyCartBar';
import { ReviewKOTModal } from '../components/ReviewKOTModal';
import { TableTransferModal } from '../components/TableTransferModal';
import { TableMergeModal } from '../components/TableMergeModal';
import { VoidOrderModal } from '../components/VoidOrderModal';
import { ItemVoidModal } from '../components/ItemVoidModal';
import { MobileBillingModal } from '../components/MobileBillingModal';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { OrderItem, MenuItem } from '../types';

interface OrderScreenProps {
  onOrderSuccess: () => void;
}

export const OrderScreen: React.FC<OrderScreenProps> = ({ onOrderSuccess }) => {
  const {
    menu,
    categories,
    selectedTable,
    setSelectedTable,
    activeOrder,
    cart,
    addToCart,
    updateCartQty,
    cartCount,
    cartTotal,
    refreshData,
    toggle86,
    can,
  } = usePOS();

  const canOrder = can('order.create');
  const canSettle = can('bill.settle');
  const canMove = can('table.move');
  const canStock = can('menu.stock');

  // Mode: Menu vs Running Items
  const [activeTab, setActiveTab] = useState<'menu' | 'running'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [is86ManagerMode, setIs86ManagerMode] = useState<boolean>(false);

  // Modals
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState<boolean>(false);
  const [showBillingModal, setShowBillingModal] = useState<boolean>(false);

  // Void item modal state
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [selectedVoidItemIndex, setSelectedVoidItemIndex] = useState<number | null>(null);
  const [selectedVoidItem, setSelectedVoidItem] = useState<OrderItem | null>(null);

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menu, selectedCategory, searchQuery]);

  // Running non-voided total
  const runningTotal = useMemo(() => {
    if (!activeOrder) return 0;
    return activeOrder.items
      .filter((it) => !it.isVoided)
      .reduce((s, it) => s + it.price * it.qty, 0);
  }, [activeOrder]);

  const handleToggle86Item = async (item: MenuItem) => {
    const nextAvailability = !item.isAvailable;
    const res = await toggle86(item.id, nextAvailability);
    if (res.success) {
      Alert.alert(
        nextAvailability ? 'Restored In Stock' : '86 OUT OF STOCK',
        `${item.name} is now ${nextAvailability ? 'AVAILABLE' : '86 OUT OF STOCK'}.`
      );
    } else {
      Alert.alert('Update Failed', res.error || 'Failed to update stock status.');
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. TABLE BANNER & QUICK ACTIONS */}
      <View style={styles.orderHeaderBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderTableLabel}>Selected Table</Text>
          <Text style={styles.orderTableName}>{selectedTable}</Text>
          {activeOrder ? (
            <Text style={styles.runningOrderText}>
              Running: ₹{runningTotal.toFixed(2)} (#{activeOrder.orderNumber || activeOrder.id.slice(-6).toUpperCase()})
            </Text>
          ) : (
            <Text style={styles.vacantTableText}>● Vacant Table (Ready for Guests)</Text>
          )}
        </View>

        {/* Action Buttons if table is occupied */}
        {activeOrder ? (
          <View style={styles.headerActionsColumn}>
            {canSettle ? (
              <TouchableOpacity
                style={styles.settleBtnHeader}
                onPress={() => setShowBillingModal(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="receipt" size={14} color="#ffffff" />
                <Text style={styles.settleBtnHeaderText}>Settle Bill</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.subActionsRow}>
              {canMove ? (
                <TouchableOpacity
                  style={styles.actionBtnSmall}
                  onPress={() => setShowTransferModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={12} color={COLORS.gold} />
                  <Text style={styles.actionBtnSmallText}>Shift</Text>
                </TouchableOpacity>
              ) : null}

              {canMove ? (
                <TouchableOpacity
                  style={[styles.actionBtnSmall, { borderColor: '#818cf8' }]}
                  onPress={() => setShowMergeModal(true)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="call-merge" size={12} color="#818cf8" />
                  <Text style={[styles.actionBtnSmallText, { color: '#818cf8' }]}>Merge</Text>
                </TouchableOpacity>
              ) : null}

              {canOrder ? (
                <TouchableOpacity
                  style={[styles.actionBtnSmall, { borderColor: '#ef4444' }]}
                  onPress={() => setShowCancelOrderModal(true)}
                  activeOpacity={0.8}
                >
                  <Feather name="x-circle" size={12} color="#ef4444" />
                  <Text style={[styles.actionBtnSmallText, { color: '#ef4444' }]}>Void</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* 2. SEGMENTED SWITCH: Menu Catalog vs Running Items */}
      {activeOrder && activeOrder.items.length > 0 ? (
        <View style={styles.tabSwitchRow}>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === 'menu' && styles.tabSwitchBtnActive]}
            onPress={() => setActiveTab('menu')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabSwitchText, activeTab === 'menu' && styles.tabSwitchTextActive]}>
              Menu Catalog
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === 'running' && styles.tabSwitchBtnActive]}
            onPress={() => setActiveTab('running')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabSwitchText,
                activeTab === 'running' && styles.tabSwitchTextActive,
              ]}
            >
              Running Items ({activeOrder.items.filter((x) => !x.isVoided).length})
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 3. RUNNING ITEMS TAB */}
      {activeTab === 'running' && activeOrder ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.runningListContainer}>
            {activeOrder.items.map((it, idx) => (
              <View
                key={idx}
                style={[styles.runningItemRow, it.isVoided && styles.runningItemRowVoided]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.runningItemName,
                      it.isVoided && styles.runningItemNameVoided,
                    ]}
                  >
                    {it.qty}x {it.name}
                  </Text>
                  <Text style={styles.runningItemMeta}>
                    {it.station} · ₹{(it.price * it.qty).toFixed(2)}
                    {it.isVoided ? ` · VOIDED (${it.voidReason || 'Admin'})` : ''}
                  </Text>
                </View>

                {it.isVoided ? (
                  <View style={styles.voidBadge}>
                    <Text style={styles.voidBadgeText}>VOID</Text>
                  </View>
                ) : canOrder ? (
                  <TouchableOpacity
                    style={styles.voidBtn}
                    onPress={() => {
                      setSelectedVoidItemIndex(idx);
                      setSelectedVoidItem(it);
                      setShowVoidModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.voidBtnText}>Void Item</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {/* Quick Settle footer in running items */}
            {canSettle ? (
              <TouchableOpacity
                style={styles.fullSettleBar}
                onPress={() => setShowBillingModal(true)}
              >
                <MaterialCommunityIcons name="receipt" size={18} color="#ffffff" />
                <Text style={styles.fullSettleBarText}>
                  Settle & Print Receipt • Total: ₹{runningTotal.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        /* 4. MENU CATALOG VIEW */
        <View style={{ flex: 1 }}>
          {/* Search Bar + 86 Manager Mode Toggle */}
          <View style={styles.searchAnd86Row}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search food, drinks, shisha..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {canStock ? (
            <TouchableOpacity
              style={[styles.btn86Mode, is86ManagerMode && styles.btn86ModeActive]}
              onPress={() => setIs86ManagerMode((prev) => !prev)}
            >
              <MaterialCommunityIcons
                name="store-cog"
                size={16}
                color={is86ManagerMode ? '#ffffff' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.btn86ModeText,
                  is86ManagerMode && styles.btn86ModeTextActive,
                ]}
              >
                {is86ManagerMode ? '86 Mode ON' : '86 Mode'}
              </Text>
            </TouchableOpacity>
            ) : null}
          </View>

          {/* Category Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={{ paddingVertical: 2 }}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategory === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Menu List */}
          <FlatList
            data={filteredMenu}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cartItem = cart.find((x) => x.id === item.id);
              return (
                <MenuItemCard
                  item={item}
                  cartItem={cartItem}
                  onAdd={addToCart}
                  onUpdateQty={updateCartQty}
                  is86ManagerMode={canStock && is86ManagerMode}
                  onToggle86={handleToggle86Item}
                  readOnly={!canOrder}
                />
              );
            }}
          />
        </View>
      )}

      {/* 5. FLOATING CART BAR */}
      <StickyCartBar
        count={canOrder ? cartCount : 0}
        total={cartTotal}
        onReview={() => setShowReviewModal(true)}
      />

      {/* 6. MODALS */}
      {/* Review & Punch KOT Modal */}
      <ReviewKOTModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          setShowReviewModal(false);
          onOrderSuccess();
        }}
      />

      {/* Table Transfer Modal */}
      {activeOrder && (
        <TableTransferModal
          visible={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          fromTable={selectedTable}
          orderNumber={activeOrder.orderNumber || activeOrder.id}
          onSuccess={() => {
            setShowTransferModal(false);
            refreshData();
          }}
        />
      )}

      {/* Table Merge Modal */}
      <TableMergeModal
        visible={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onSuccess={(newTable) => {
          setShowMergeModal(false);
          setSelectedTable(newTable);
          refreshData();
        }}
      />

      {/* Void Entire Order Modal */}
      {activeOrder && (
        <VoidOrderModal
          visible={showCancelOrderModal}
          orderId={activeOrder.id}
          tableName={selectedTable}
          onClose={() => setShowCancelOrderModal(false)}
          onSuccess={() => {
            setShowCancelOrderModal(false);
            refreshData();
          }}
        />
      )}

      {/* Item Void Modal */}
      {activeOrder && selectedVoidItem && (
        <ItemVoidModal
          visible={showVoidModal}
          onClose={() => {
            setShowVoidModal(false);
            setSelectedVoidItem(null);
            setSelectedVoidItemIndex(null);
          }}
          orderId={activeOrder.id}
          itemIndex={selectedVoidItemIndex}
          itemName={selectedVoidItem.name}
          itemPrice={selectedVoidItem.price}
          itemQty={selectedVoidItem.qty}
          onSuccess={() => {
            setShowVoidModal(false);
            refreshData();
          }}
        />
      )}

      {/* Mobile Billing & Checkout Modal */}
      <MobileBillingModal
        visible={showBillingModal}
        order={activeOrder || null}
        onClose={() => setShowBillingModal(false)}
        onSettledSuccess={() => {
          setShowBillingModal(false);
          refreshData();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  orderHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  orderTableLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderTableName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  runningOrderText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  vacantTableText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  headerActionsColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  settleBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.kitchen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settleBtnHeaderText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  subActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBtnSmallText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '700',
  },
  tabSwitchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabSwitchBtnActive: {
    backgroundColor: COLORS.primary,
  },
  tabSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabSwitchTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  runningListContainer: {
    gap: 8,
    paddingBottom: 24,
  },
  runningItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  runningItemRowVoided: {
    opacity: 0.4,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  runningItemName: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  runningItemNameVoided: {
    textDecorationLine: 'line-through',
    color: '#ef4444',
  },
  runningItemMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  voidBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  voidBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  voidBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  voidBadgeText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
  },
  fullSettleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.kitchen,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  fullSettleBarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  searchAnd86Row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 12,
    padding: 0,
  },
  btn86Mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  btn86ModeActive: {
    backgroundColor: '#9f1119',
    borderColor: '#ef4444',
  },
  btn86ModeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  btn86ModeTextActive: {
    color: '#ffffff',
  },
  categoryScroll: {
    maxHeight: 38,
    marginBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.bgSurface,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryHover,
  },
  categoryPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  menuList: {
    gap: 8,
    paddingBottom: 70,
  },
});
