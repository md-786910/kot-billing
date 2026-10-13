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
import { Ionicons } from '@expo/vector-icons';
import { MenuItemCard } from '../components/MenuItemCard';
import { StickyCartBar } from '../components/StickyCartBar';
import { ReviewKOTModal } from '../components/ReviewKOTModal';
import { TableTransferModal } from '../components/TableTransferModal';
import { ItemVoidModal } from '../components/ItemVoidModal';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { OrderItem } from '../types';

interface OrderScreenProps {
  onOrderSuccess: () => void;
}

export const OrderScreen: React.FC<OrderScreenProps> = ({ onOrderSuccess }) => {
  const {
    menu,
    categories,
    selectedTable,
    activeOrder,
    cart,
    addToCart,
    updateCartQty,
    cartCount,
    cartTotal,
    refreshData,
  } = usePOS();

  // Mode: Menu vs Running Items
  const [activeTab, setActiveTab] = useState<'menu' | 'running'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);

  // Void modal state
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

  return (
    <View style={styles.container}>
      {/* Table Banner & Active Order Overview */}
      <View style={styles.orderHeaderBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderTableLabel}>Selected Table</Text>
          <Text style={styles.orderTableName}>{selectedTable}</Text>
          {activeOrder ? (
            <Text style={styles.runningOrderText}>
              Running: ₹{runningTotal.toFixed(2)} (#{activeOrder.orderNumber || activeOrder.id})
            </Text>
          ) : (
            <Text style={styles.vacantTableText}>Vacant Table (New Guest)</Text>
          )}
        </View>

        {/* Quick Shift Button if table is occupied */}
        {activeOrder ? (
          <TouchableOpacity
            style={styles.shiftTableBtn}
            onPress={() => setShowTransferModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal" size={14} color={COLORS.gold} />
            <Text style={styles.shiftTableBtnText}>Shift Table</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Segmented Switch (If occupied) */}
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

      {activeTab === 'running' && activeOrder ? (
        /* Running Items List with VOID Action */
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

                {!it.isVoided ? (
                  <TouchableOpacity
                    style={styles.voidBtn}
                    onPress={() => {
                      setSelectedVoidItemIndex(idx);
                      setSelectedVoidItem(it);
                      setShowVoidModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.voidBtnText}>Void</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.voidBadge}>
                    <Text style={styles.voidBadgeText}>VOID</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Menu Catalog View */
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items, drinks, shisha..."
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
                />
              );
            }}
          />
        </View>
      )}

      {/* Floating Cart Bar (Always accessible when items are selected) */}
      <StickyCartBar
        count={cartCount}
        total={cartTotal}
        onReview={() => setShowReviewModal(true)}
      />

      {/* Review Modal */}
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
    borderRadius: 12,
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
  shiftTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  shiftTableBtnText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  tabSwitchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabSwitchBtnActive: {
    backgroundColor: COLORS.primary,
  },
  tabSwitchText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabSwitchTextActive: {
    color: '#ffffff',
  },
  runningListContainer: {
    gap: 8,
    paddingBottom: 85,
  },
  runningItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  runningItemRowVoided: {
    opacity: 0.6,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#161314',
  },
  runningItemName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  runningItemNameVoided: {
    textDecorationLine: 'line-through',
    color: '#f87171',
  },
  runningItemMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  voidBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  voidBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
  },
  voidBadge: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  voidBadgeText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  categoryScroll: {
    maxHeight: 38,
    marginBottom: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    marginRight: 6,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryHover,
  },
  categoryPillText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  menuList: {
    paddingBottom: 85,
  },
});
