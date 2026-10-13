import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({ visible, onClose }) => {
  const { serverUrl, updateServerUrl, refreshData } = usePOS();
  const [inputUrl, setInputUrl] = useState(serverUrl);

  const handleSave = async () => {
    updateServerUrl(inputUrl);
    onClose();
    await refreshData();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Backend Server Config</Text>
          <Text style={styles.modalDesc}>
            Enter Next.js server URL (Local Wi-Fi IP or Cloud Domain):
          </Text>

          <TextInput
            style={styles.serverInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="http://192.168.1.50:3000"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Connect & Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 18,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  modalDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  serverInput: {
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
