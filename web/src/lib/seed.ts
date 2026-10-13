import { TableModel } from '../models/Table';
import { MenuItemModel } from '../models/MenuItem';
import { SettingsModel } from '../models/Settings';
import { migrateLegacyPins } from './auth';
import { OrderModel } from '../models/Order';
import { KOTModel } from '../models/KOT';

export const INITIAL_TABLES = [
  { name: 'Table 1', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'Table 2', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'Table 3', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'Table 4', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'Table 5', floor: 'Main Floor', type: 'regular', capacity: 6, hourlyRate: 0 },
  { name: 'Table 6', floor: 'Main Floor', type: 'regular', capacity: 6, hourlyRate: 0 },
  { name: 'Table 7', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'Table 8', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'Table 9', floor: 'Main Floor', type: 'regular', capacity: 4, hourlyRate: 0 },
  { name: 'VIP Lounge', floor: '2nd Floor', type: 'private', capacity: 12, hourlyRate: 500 },
  { name: 'Couple Cabin', floor: '1st Floor', type: 'private', capacity: 2, hourlyRate: 300 },
];

export const INITIAL_MENU = [
  // Shisha
  { name: 'Branded Single Flavour', price: 249, station: 'Shisha Master', category: 'Shisha', isAvailable: true, prepTimeMin: 10 },
  { name: 'Branded Double Flavour', price: 299, station: 'Shisha Master', category: 'Shisha', isAvailable: true, prepTimeMin: 10 },
  { name: 'Afzal Single Flavour', price: 299, station: 'Shisha Master', category: 'Shisha', isAvailable: true, prepTimeMin: 10 },
  { name: 'Afzal Mix Flavour', price: 349, station: 'Shisha Master', category: 'Shisha', isAvailable: true, prepTimeMin: 10 },

  // Shisha Extras
  { name: 'Milk Base', price: 49, station: 'Shisha Master', category: 'Shisha Extras', isAvailable: true, prepTimeMin: 5 },
  { name: 'Mint Mojito Base', price: 49, station: 'Shisha Master', category: 'Shisha Extras', isAvailable: true, prepTimeMin: 5 },
  { name: 'Chilled Water', price: 20, station: 'Shisha Master', category: 'Shisha Extras', isAvailable: true, prepTimeMin: 2 },
  { name: 'Extra Nozzle', price: 10, station: 'Shisha Master', category: 'Shisha Extras', isAvailable: true, prepTimeMin: 1 },

  // Beverages - Mojitos
  { name: 'Apple Rush Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', isAvailable: true, prepTimeMin: 7 },
  { name: 'Tropical Gold Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', isAvailable: true, prepTimeMin: 7 },
  { name: 'Red Breeze Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', isAvailable: true, prepTimeMin: 7 },
  { name: 'Berry Bliss Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', isAvailable: true, prepTimeMin: 7 },
  { name: 'Litchi Mist Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', isAvailable: true, prepTimeMin: 7 },
  { name: 'Mango Sunset Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', isAvailable: true, prepTimeMin: 7 },

  // Beverages - Sodas
  { name: 'Green Apple Soda', price: 99, station: 'Beverage Counter', category: 'Sodas', isAvailable: true, prepTimeMin: 5 },
  { name: 'Pineapple Soda', price: 99, station: 'Beverage Counter', category: 'Sodas', isAvailable: true, prepTimeMin: 5 },
  { name: 'Watermelon Soda', price: 99, station: 'Beverage Counter', category: 'Sodas', isAvailable: true, prepTimeMin: 5 },
  { name: 'Strawberry Soda', price: 99, station: 'Beverage Counter', category: 'Sodas', isAvailable: true, prepTimeMin: 5 },
  { name: 'Litchi Soda', price: 99, station: 'Beverage Counter', category: 'Sodas', isAvailable: true, prepTimeMin: 5 },

  // Cold Drinks
  { name: 'Any 3 Cold Drinks Offer', price: 99, station: 'Beverage Counter', category: 'Cold Drinks', isAvailable: true, prepTimeMin: 3 },
  { name: 'Root Beer', price: 99, station: 'Beverage Counter', category: 'Cold Drinks', isAvailable: true, prepTimeMin: 3 },

  // Kitchen - Burgers
  { name: 'Classic Burger', price: 99, station: 'Kitchen', category: 'Burgers', isAvailable: true, prepTimeMin: 15 },
  { name: 'Cheese Burger', price: 99, station: 'Kitchen', category: 'Burgers', isAvailable: true, prepTimeMin: 15 },
  { name: 'Chicken Burger', price: 99, station: 'Kitchen', category: 'Burgers', isAvailable: true, prepTimeMin: 15 },

  // Kitchen - Fried Rice
  { name: 'Veg Fried Rice', price: 99, station: 'Kitchen', category: 'Fried Rice', isAvailable: true, prepTimeMin: 15 },
  { name: 'Chicken Fried Rice', price: 99, station: 'Kitchen', category: 'Fried Rice', isAvailable: true, prepTimeMin: 15 },
  { name: 'Egg Fried Rice', price: 99, station: 'Kitchen', category: 'Fried Rice', isAvailable: true, prepTimeMin: 15 },

  // Kitchen - Maggie
  { name: 'Mix Veg Maggie', price: 99, station: 'Kitchen', category: 'Maggie', isAvailable: true, prepTimeMin: 10 },
  { name: 'Double Maggie Masala', price: 99, station: 'Kitchen', category: 'Maggie', isAvailable: true, prepTimeMin: 10 },
  { name: 'Double Cheese Maggie', price: 99, station: 'Kitchen', category: 'Maggie', isAvailable: true, prepTimeMin: 10 },

  // Kitchen - Fries & Nuggets
  { name: 'Classic Fries', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', isAvailable: true, prepTimeMin: 12 },
  { name: 'Peri Peri Fries', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', isAvailable: true, prepTimeMin: 12 },
  { name: 'Cheese Fries', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', isAvailable: true, prepTimeMin: 12 },
  { name: 'Veg Nuggets', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', isAvailable: true, prepTimeMin: 12 },
  { name: 'Corn N Cheese Nuggets', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', isAvailable: true, prepTimeMin: 12 },
  { name: 'Chicken Nuggets', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', isAvailable: true, prepTimeMin: 12 },

  // Kitchen - Chilli
  { name: 'Mix Veg Chilli', price: 99, station: 'Kitchen', category: 'Chilli', isAvailable: true, prepTimeMin: 15 },
  { name: 'Soya Chilli', price: 99, station: 'Kitchen', category: 'Chilli', isAvailable: true, prepTimeMin: 15 },
  { name: 'Mushroom Chilli', price: 99, station: 'Kitchen', category: 'Chilli', isAvailable: true, prepTimeMin: 15 },
  { name: 'Paneer Chilli', price: 99, station: 'Kitchen', category: 'Chilli', isAvailable: true, prepTimeMin: 15 },
  { name: 'Chicken Chilli', price: 99, station: 'Kitchen', category: 'Chilli', isAvailable: true, prepTimeMin: 15 },

  // Kitchen - Rolls
  { name: 'Veg Roll', price: 99, station: 'Kitchen', category: 'Rolls', isAvailable: true, prepTimeMin: 12 },
  { name: 'Egg Roll', price: 99, station: 'Kitchen', category: 'Rolls', isAvailable: true, prepTimeMin: 12 },
  { name: 'Paneer Roll', price: 99, station: 'Kitchen', category: 'Rolls', isAvailable: true, prepTimeMin: 12 },
  { name: 'Chicken Roll', price: 99, station: 'Kitchen', category: 'Rolls', isAvailable: true, prepTimeMin: 12 },

  // Kitchen - Noodles
  { name: 'Mix Veg Hakka Noodles', price: 99, station: 'Kitchen', category: 'Noodles', isAvailable: true, prepTimeMin: 15 },
  { name: 'Egg Hakka Noodles', price: 99, station: 'Kitchen', category: 'Noodles', isAvailable: true, prepTimeMin: 15 },
  { name: 'Chicken Hakka Noodles', price: 99, station: 'Kitchen', category: 'Noodles', isAvailable: true, prepTimeMin: 15 },

  // Kitchen - Sandwiches & Pasta
  { name: 'Veg Sandwich', price: 99, station: 'Kitchen', category: 'Sandwiches', isAvailable: true, prepTimeMin: 10 },
  { name: 'White Sauce Pasta', price: 99, station: 'Kitchen', category: 'Pasta', isAvailable: true, prepTimeMin: 15 },
  { name: 'Mix Sauce Pasta', price: 99, station: 'Kitchen', category: 'Pasta', isAvailable: true, prepTimeMin: 15 },
];

export async function seedDatabaseIfEmpty() {
  const tableCount = await TableModel.countDocuments();
  if (tableCount === 0) {
    await TableModel.insertMany(INITIAL_TABLES);
  }

  const menuCount = await MenuItemModel.countDocuments();
  if (menuCount === 0) {
    await MenuItemModel.insertMany(INITIAL_MENU);
  }

  const settingsCount = await SettingsModel.countDocuments();
  if (settingsCount === 0) {
    await SettingsModel.create({
      loungeName: 'LAYALI SHISHA LOUNGE',
      tagline: 'PREMIUM LOUNGE & CAFE',
      address: '',
      phone: '',
      gstNumber: '',
      taxPercent: 5,
      soundAlerts: true,
      shishaDefaultDuration: 45,
      upiId: '',
    });
  }

  // Staff are created by the owner after first-run setup; hash any PINs stored by older builds
  await migrateLegacyPins();

  // Seed sample initial active order if no orders exist
  const orderCount = await OrderModel.countDocuments();
  if (orderCount === 0) {
    const sampleOrder = await OrderModel.create({
      orderNumber: 'LY-1001',
      tableName: 'Table 1',
      guestName: 'Aman Sharma',
      guestPhone: '9876543210',
      staffName: 'Captain 1',
      status: 'OPEN',
      items: [
        { name: 'Afzal Mix Flavour', price: 349, station: 'Shisha Master', category: 'Shisha', qty: 1, notes: 'Paan Ras + Spring Water' },
        { name: 'Mint Mojito Base', price: 49, station: 'Shisha Master', category: 'Shisha Extras', qty: 1 },
        { name: 'Apple Rush Mojito', price: 99, station: 'Beverage Counter', category: 'Mojitos', qty: 2, notes: 'Cold crushed ice' },
        { name: 'Chicken Burger', price: 99, station: 'Kitchen', category: 'Burgers', qty: 2 },
        { name: 'Peri Peri Fries', price: 99, station: 'Kitchen', category: 'Fries & Nuggets', qty: 1, notes: 'Extra crispy' },
      ],
      notes: 'Paan Ras + Spring Water mix base. Extra crispy fries.',
      shishaAdvance: 200,
      duration: 45,
      taxPercent: 5,
      discountAmount: 0,
      closed: false,
    });

    await TableModel.updateOne({ name: 'Table 1' }, { status: 'OCCUPIED', currentOrderId: sampleOrder._id.toString() });

    await KOTModel.create([
      {
        kotNumber: 'KOT-0001',
        orderId: sampleOrder._id.toString(),
        orderNumber: 'LY-1001',
        tableName: 'Table 1',
        guestName: 'Aman Sharma',
        station: 'Shisha Master',
        items: [
          { name: 'Afzal Mix Flavour', price: 349, qty: 1, notes: 'Paan Ras' },
          { name: 'Mint Mojito Base', price: 49, qty: 1 },
        ],
        notes: 'Paan Ras + Spring Water mix base',
        duration: 45,
        status: 'PREPARING',
        startedAt: new Date(),
      },
      {
        kotNumber: 'KOT-0002',
        orderId: sampleOrder._id.toString(),
        orderNumber: 'LY-1001',
        tableName: 'Table 1',
        guestName: 'Aman Sharma',
        station: 'Beverage Counter',
        items: [{ name: 'Apple Rush Mojito', price: 99, qty: 2, notes: 'Crushed ice' }],
        status: 'READY',
        readyAt: new Date(),
      },
      {
        kotNumber: 'KOT-0003',
        orderId: sampleOrder._id.toString(),
        orderNumber: 'LY-1001',
        tableName: 'Table 1',
        guestName: 'Aman Sharma',
        station: 'Kitchen',
        items: [
          { name: 'Chicken Burger', price: 99, qty: 2 },
          { name: 'Peri Peri Fries', price: 99, qty: 1, notes: 'Extra crispy' },
        ],
        notes: 'Extra crispy fries',
        status: 'NEW',
      },
    ]);
  }
}
