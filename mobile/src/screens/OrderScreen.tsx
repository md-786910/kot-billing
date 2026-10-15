import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Alert } from '../ui/alert';
import { Feather } from '@expo/vector-icons';
import { MenuItemCard } from '../components/MenuItemCard';
import { StickyCartBar } from '../components/StickyCartBar';
import { ReviewKOTModal } from '../components/ReviewKOTModal';
import { TableTransferModal } from '../components/TableTransferModal';
import { TableMergeModal } from '../components/TableMergeModal';
import { VoidOrderModal } from '../components/VoidOrderModal';
import { ItemVoidModal } from '../components/ItemVoidModal';
import { MobileBillingModal } from '../components/MobileBillingModal';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE, stationColors } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { usePrintStatus } from '../hooks/usePrintStatus';
import { useContentWidth, useGrid } from '../hooks/useGrid';
import { errorMessage } from '../services/api';
import { requestBillPrint } from '../services/printApi';
import { Order, OrderItem, MenuItem } from '../types';
import {
  ActionTile,
  AppText,
  Badge,
  Banner,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  IconButton,
  Segmented,
  formatElapsed,
  formatMoney,
} from '../ui';

interface OrderScreenProps {
  /** Called after a KOT is sent, with a short confirmation for the toast */
  onOrderSuccess: (message: string) => void;
}

type OrderView = 'menu' | 'running';

/** Content width (dp) from which the bill panel sits beside the menu (tablet landscape and up) */
const SPLIT_MIN_WIDTH = 840;

export const OrderScreen: React.FC<OrderScreenProps> = ({ onOrderSuccess }) => {
  const {
    menu,
    categories,
    tables,
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

  // Menu vs items already sent for this table
  const [activeTab, setActiveTab] = useState<OrderView>('menu');
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

  // Keep the "32 min" in the status line current while the screen is open
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

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
    if (res.busy) return;
    if (res.success) {
      Alert.alert(
        nextAvailability ? 'Back in stock' : 'Marked out of stock',
        `${item.name} is now ${nextAvailability ? 'available' : 'out of stock'}.`
      );
    } else {
      Alert.alert("Couldn't update stock", res.error || 'Failed to update stock status.');
    }
  };

  const showRunning = activeTab === 'running' && !!activeOrder;
  const liveItemCount = activeOrder ? activeOrder.items.filter((x) => !x.isVoided).length : 0;

  const capacity = tables.find((t) => t.name === selectedTable)?.capacity;
  const statusLine = activeOrder
    ? [
        `#${activeOrder.orderNumber || activeOrder.id.slice(-6).toUpperCase()}`,
        `${formatMoney(runningTotal)} running`,
        formatElapsed(activeOrder.createdAt, now),
      ]
        .filter(Boolean)
        .join(' · ')
    : capacity
    ? `Free table · ${capacity} seat${capacity === 1 ? '' : 's'}`
    : 'Free table';

  const openBilling = () => setShowBillingModal(true);

  // Bill slip for the guest, printed at the counter (phones never print themselves)
  const { status: printStatus } = usePrintStatus();
  // Wide screens show the menu and the bill side by side; narrower ones switch between them
  const contentWidth = useContentWidth();
  const split = contentWidth >= SPLIT_MIN_WIDTH;
  const panelWidth = Math.min(420, Math.max(340, Math.round(contentWidth * 0.38)));
  // One column on phones, two or more on tablets (sized to the menu pane when split)
  const menuGrid = useGrid(260, SPACE.lg, SPACE.sm, split ? contentWidth - panelWidth : undefined);
  const [printingBill, setPrintingBill] = useState(false);
  const printingBillRef = useRef(false);
  const printBill = async () => {
    if (!activeOrder || printingBillRef.current) return;
    printingBillRef.current = true;
    setPrintingBill(true);
    try {
      await requestBillPrint(activeOrder.id);
      const station = printStatus?.station;
      Alert.alert(
        'Bill sent to the counter printer',
        station && !station.configured
          ? 'No counter printer is set yet. Ask the owner to choose one in Devices.'
          : station && !station.online
          ? "The counter printer is offline. It will print when it's back."
          : `${selectedTable} · collect it at the counter.`
      );
    } catch (err) {
      Alert.alert("Couldn't print the bill", errorMessage(err, 'Try again.'));
    } finally {
      printingBillRef.current = false;
      setPrintingBill(false);
    }
  };

  const actionTiles = activeOrder
    ? [
        canSettle && <ActionTile key="bill" icon="file-text" label="Bill" onPress={openBilling} testID="action-bill" />,
        canSettle && (
          <ActionTile key="print-bill" icon="printer" label="Print bill" onPress={printBill} disabled={printingBill} testID="action-print-bill" />
        ),
        canMove && <ActionTile key="move" icon="shuffle" label="Move" onPress={() => setShowTransferModal(true)} testID="action-move" />,
        canMove && <ActionTile key="merge" icon="git-merge" label="Merge" onPress={() => setShowMergeModal(true)} testID="action-merge" />,
        canOrder && (
          <ActionTile key="void" icon="x-circle" label="Void" tone="danger" onPress={() => setShowCancelOrderModal(true)} testID="action-void" />
        ),
      ].filter(Boolean)
    : [];

  // Items already sent for this table, each with its own Void
  const renderOrderedItems = (order: Order) => (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {order.items.length === 0 ? (
        <EmptyState icon="clipboard" title="Nothing ordered yet" hint="Items show here once they're sent to the kitchen." />
      ) : (
        order.items.map((it, idx) => {
          const station = stationColors(it.station);
          return (
            <View key={idx} style={styles.orderedRow} testID={`ordered-item-${idx}`}>
              <View style={[styles.flex, styles.orderedInfo, it.isVoided && styles.voided]}>
                <AppText variant="bodyStrong" tone={it.isVoided ? 'muted' : 'primary'} style={it.isVoided && styles.strike}>
                  {it.qty}× {it.name}
                </AppText>
                <View style={styles.badges}>
                  <Badge label={station.short} fg={station.fg} bg={station.bg} />
                  {it.isVoided ? <Badge label="Voided" fg={COLORS.danger} bg={COLORS.dangerBg} /> : null}
                </View>
                {it.notes ? (
                  <AppText variant="caption" tone="secondary">
                    {it.notes}
                  </AppText>
                ) : null}
                {it.isVoided && it.voidReason ? (
                  <AppText variant="caption" tone="muted">
                    Reason: {it.voidReason}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.orderedRight}>
                <AppText
                  variant="bodyStrong"
                  money
                  tone={it.isVoided ? 'muted' : 'primary'}
                  style={it.isVoided && styles.strike}
                >
                  {formatMoney(it.price * it.qty)}
                </AppText>
                {!it.isVoided && canOrder ? (
                  <Button
                    label="Void"
                    variant="dangerGhost"
                    onPress={() => {
                      setSelectedVoidItemIndex(idx);
                      setSelectedVoidItem(it);
                      setShowVoidModal(true);
                    }}
                    testID={`void-item-${idx}`}
                    accessibilityLabel={`Void ${it.name}`}
                    style={styles.voidBtn}
                  />
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const renderSettleFooter = () =>
    canSettle ? (
      <View style={styles.footer}>
        <Button
          label="Settle bill"
          size="lg"
          // The cart bar's Review order is the main action while there are unsent items
          variant={canOrder && cartCount > 0 ? 'secondary' : 'primary'}
          trailing={formatMoney(runningTotal)}
          onPress={openBilling}
          testID="settle"
        />
      </View>
    ) : null;

  const renderMenu = () => (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search menu"
            testID="menu-search"
          />
          {searchQuery ? (
            <IconButton icon="x" label="Clear search" tone="muted" onPress={() => setSearchQuery('')} testID="menu-search-clear" />
          ) : null}
        </View>
        {canStock ? (
          <Chip label="Edit stock" selected={is86ManagerMode} onPress={() => setIs86ManagerMode((prev) => !prev)} testID="stock-mode" />
        ) : null}
      </View>

      <ChipRow style={styles.categories}>
        {categories.map((cat) => (
          <Chip
            key={cat}
            label={cat}
            selected={selectedCategory === cat}
            onPress={() => setSelectedCategory(cat)}
            testID={`category-${cat}`}
          />
        ))}
      </ChipRow>

      {canStock && is86ManagerMode ? (
        <View style={styles.banner}>
          <Banner tone="info" text="Tap a status to mark an item in or out of stock." actionLabel="Done" onAction={() => setIs86ManagerMode(false)} />
        </View>
      ) : null}

      <FlatList
        key={`menu-${menuGrid.columns}`}
        data={filteredMenu}
        keyExtractor={(item) => item.id}
        numColumns={menuGrid.columns}
        columnWrapperStyle={menuGrid.columns > 1 ? styles.row : undefined}
        style={styles.flex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          searchQuery ? (
            <EmptyState icon="search" title="No matches" hint={`Nothing on the menu matches "${searchQuery}".`} />
          ) : (
            <EmptyState icon="book-open" title="No items here" hint="Pick another category." />
          )
        }
        renderItem={({ item }) => {
          const cartItem = cart.find((x) => x.id === item.id);
          return (
            <View style={{ width: menuGrid.itemWidth }}>
              <MenuItemCard
                item={item}
                cartItem={cartItem}
                onAdd={addToCart}
                onUpdateQty={updateCartQty}
                is86ManagerMode={canStock && is86ManagerMode}
                onToggle86={handleToggle86Item}
                readOnly={!canOrder}
              />
            </View>
          );
        }}
      />
    </View>
  );

  // Unsent items, pinned above the bottom nav
  const cartBar = <StickyCartBar count={canOrder ? cartCount : 0} total={cartTotal} onReview={() => setShowReviewModal(true)} />;

  return (
    <View style={styles.container}>
      {split ? (
        // Wide screens (tablet landscape): menu on the left, the table's bill always visible on the right
        <View style={[styles.flex, styles.split]}>
          <View style={styles.flex}>
            {renderMenu()}
            {cartBar}
          </View>
          <View style={[styles.panel, { width: panelWidth }]} testID="bill-panel">
            <View style={styles.top}>
              <AppText variant="caption" tone={activeOrder ? 'secondary' : 'muted'} money numberOfLines={1} testID="order-status">
                {statusLine}
              </AppText>
              {actionTiles.length > 0 ? (
                <View style={styles.tilesWrap}>
                  {actionTiles.map((tile) => (
                    <View key={(tile as React.ReactElement).key} style={styles.tileCell}>
                      {tile}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {activeOrder ? (
              <>
                {renderOrderedItems(activeOrder)}
                {renderSettleFooter()}
              </>
            ) : (
              <EmptyState icon="file-text" title="No bill yet" hint="Items appear here once you send them to the kitchen." />
            )}
          </View>
        </View>
      ) : (
        <>
          {/* Table status, Menu | Ordered switch, and table actions (the Header already shows the table name) */}
          <View style={styles.top}>
            <AppText variant="caption" tone={activeOrder ? 'secondary' : 'muted'} money numberOfLines={1} testID="order-status">
              {statusLine}
            </AppText>

            {activeOrder ? (
              <Segmented<OrderView>
                value={showRunning ? 'running' : 'menu'}
                onChange={setActiveTab}
                options={[
                  { key: 'menu', label: 'Menu', testID: 'seg-menu' },
                  { key: 'running', label: `Ordered (${liveItemCount})`, testID: 'seg-ordered' },
                ]}
              />
            ) : null}

            {/* Bill, Print bill, Move, Merge and Void act on the table's bill, so they live on the Ordered tab;
                the Menu tab keeps the full height for adding items */}
            {showRunning && actionTiles.length > 0 ? <View style={styles.tiles}>{actionTiles}</View> : null}

            {/* On the Menu view, a one-line shortcut to the running bill so its actions are easy to find */}
            {activeOrder && !showRunning ? (
              <Pressable
                onPress={() => setActiveTab('running')}
                style={({ pressed }) => [styles.billBar, pressed && styles.billBarPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Bill ${formatMoney(runningTotal)}, ${liveItemCount} items. View bill, void or settle`}
                testID="bill-bar"
              >
                <Feather name="file-text" size={18} color={COLORS.gold} />
                <AppText variant="bodyStrong" money numberOfLines={1} style={styles.flex}>
                  Bill {formatMoney(runningTotal)} · {liveItemCount} item{liveItemCount === 1 ? '' : 's'}
                </AppText>
                <AppText variant="label" tone="gold">
                  View & void
                </AppText>
                <Feather name="chevron-right" size={18} color={COLORS.gold} />
              </Pressable>
            ) : null}
          </View>

          {showRunning && activeOrder ? (
            <View style={styles.flex}>
              {renderOrderedItems(activeOrder)}
              {renderSettleFooter()}
            </View>
          ) : (
            renderMenu()
          )}
          {cartBar}
        </>
      )}

      {/* Review & send KOT */}
      <ReviewKOTModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          setShowReviewModal(false);
          onOrderSuccess(`Sent to kitchen · ${selectedTable} · printing at counter`);
        }}
      />

      {/* Move table */}
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

      {/* Merge tables */}
      <TableMergeModal
        visible={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        onSuccess={(newTable) => {
          setShowMergeModal(false);
          setSelectedTable(newTable);
          refreshData();
        }}
      />

      {/* Void the whole order */}
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

      {/* Void one item */}
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

      {/* Bill & settle */}
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
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  flex: { flex: 1 },
  top: { gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm },
  tiles: { flexDirection: 'row', gap: SPACE.sm },
  billBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: TOUCH.min,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.goldSubtle,
  },
  billBarPressed: { opacity: 0.7 },

  // Split layout (wide screens)
  split: { flexDirection: 'row' },
  panel: { backgroundColor: COLORS.bgSecondary, borderLeftWidth: 1, borderLeftColor: COLORS.borderSubtle },
  // Up to three tiles per row so all five fit the panel
  tilesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  tileCell: { flexGrow: 1, flexBasis: '30%' },

  // Menu
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.xs },
  search: {
    flex: 1,
    minHeight: TOUCH.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingLeft: SPACE.md,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  searchInput: { ...TYPE.body, flex: 1, minHeight: TOUCH.min, color: COLORS.textPrimary, paddingVertical: 0 },
  categories: { paddingVertical: SPACE.sm },
  banner: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm },
  list: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.xs, paddingBottom: SPACE.xxl },
  row: { gap: SPACE.sm },

  // Ordered
  orderedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    minHeight: 64,
    paddingLeft: SPACE.lg,
    paddingRight: SPACE.sm,
    paddingVertical: SPACE.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  orderedInfo: { gap: SPACE.xs },
  orderedRight: { alignItems: 'flex-end', gap: SPACE.xs },
  voided: { opacity: 0.7 },
  strike: { textDecorationLine: 'line-through' },
  badges: { flexDirection: 'row', gap: SPACE.xs, flexWrap: 'wrap' },
  voidBtn: { paddingHorizontal: SPACE.md },
  footer: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
});
