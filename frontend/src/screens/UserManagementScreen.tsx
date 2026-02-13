/**
 * Circle for Life - User Management Screen
 * Admin panel for managing users, roles, bans, and gems.
 * Accessible from the Control Panel tab.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../config/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type UserRole = 'super_admin' | 'admin' | 'moderator' | 'creator' | 'user' | 'guest';

interface ManagedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  tier: string;
  gemBalance: number;
  trustScore: number;
  status: string;
  shadowBanned: boolean;
  bannedAt: string;
  banReason: string;
  reportCount: number;
  notes: string;
  createdAt: string;
  lastLoginAt: string;
  totalPosts: number;
  totalVotesReceived: number;
  currentStreak: number;
  referralCode: string;
  referralCount: number;
}

interface UserListResponse {
  users: ManagedUser[];
  total: number;
  page: number;
  totalPages: number;
}

const ROLES: { id: UserRole; label: string; color: string }[] = [
  { id: 'super_admin', label: 'Super Admin', color: '#FF3B30' },
  { id: 'admin', label: 'Admin', color: '#FF9500' },
  { id: 'moderator', label: 'Moderator', color: '#AF52DE' },
  { id: 'creator', label: 'Creator', color: '#30D158' },
  { id: 'user', label: 'User', color: '#7DD3FC' },
  { id: 'guest', label: 'Guest', color: '#636366' },
];

const ROLE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.id, r.color])
);

// ─── Main Screen ────────────────────────────────────────────────────────────

export function UserManagementScreen() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [stats, setStats] = useState<any>(null);

  const fetchUsers = useCallback(async (p = 1, search?: string, role?: string | null) => {
    setIsLoading(true);
    try {
      const params: any = { page: p, limit: 20 };
      if (search) params.search = search;
      if (role) params.role = role;

      const { data } = await apiClient.get<UserListResponse>('/manage/users', { params });
      setUsers(p === 1 ? data.users : [...users, ...data.users]);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [users]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/manage/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUsers(1, searchQuery, roleFilter);
    fetchStats();
  }, []);

  const handleSearch = () => {
    fetchUsers(1, searchQuery, roleFilter);
  };

  const handleRoleFilter = (role: string | null) => {
    setRoleFilter(role);
    fetchUsers(1, searchQuery, role);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !isLoading) {
      fetchUsers(page + 1, searchQuery, roleFilter);
    }
  };

  const handleAction = async (action: string, userId: string, payload?: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      switch (action) {
        case 'ban':
          await apiClient.post(`/manage/users/${userId}/ban`, {
            reason: payload?.reason || 'Violation of community guidelines',
            duration: payload?.duration || '7d',
          });
          Alert.alert('Success', 'User banned');
          break;
        case 'unban':
          await apiClient.delete(`/manage/users/${userId}/ban`);
          Alert.alert('Success', 'User unbanned');
          break;
        case 'shadow_ban':
          await apiClient.post(`/manage/users/${userId}/shadow-ban`);
          Alert.alert('Success', 'Shadow ban toggled');
          break;
        case 'role':
          await apiClient.post(`/manage/users/${userId}/role`, {
            role: payload?.role,
            reason: payload?.reason,
          });
          Alert.alert('Success', `Role changed to ${payload?.role}`);
          break;
        case 'gems':
          await apiClient.post(`/manage/users/${userId}/gems`, {
            amount: payload?.amount,
            reason: payload?.reason || 'Admin adjustment',
          });
          Alert.alert('Success', `Gems adjusted by ${payload?.amount}`);
          break;
        case 'delete':
          await apiClient.delete(`/manage/users/${userId}`);
          Alert.alert('Success', 'User deleted');
          break;
      }

      setSelectedUser(null);
      fetchUsers(1, searchQuery, roleFilter);
      fetchStats();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error?.message || 'Action failed');
    }
  };

  const renderUser = ({ item }: { item: ManagedUser }) => (
    <Pressable
      style={styles.userCard}
      onPress={() => setSelectedUser(item)}
    >
      <View style={styles.userCardTop}>
        <View style={styles.userCardLeft}>
          <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR_MAP[item.role] || '#636366' }]}>
            <Text style={styles.roleBadgeText}>{item.role}</Text>
          </View>
          <Text style={styles.userName}>{item.displayName || item.username}</Text>
        </View>
        <View style={styles.userCardRight}>
          {item.bannedAt ? (
            <View style={[styles.statusDot, { backgroundColor: '#FF3B30' }]} />
          ) : item.shadowBanned ? (
            <View style={[styles.statusDot, { backgroundColor: '#FF9500' }]} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: '#34C759' }]} />
          )}
        </View>
      </View>
      <Text style={styles.userEmail}>{item.email}</Text>
      <View style={styles.userStats}>
        <Text style={styles.userStat}>Gems: {item.gemBalance}</Text>
        <Text style={styles.userStat}>Trust: {item.trustScore}</Text>
        <Text style={styles.userStat}>Posts: {item.totalPosts}</Text>
        <Text style={styles.userStat}>Tier: {item.tier}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        {stats && (
          <Text style={styles.totalCount}>{stats.totalUsers} users</Text>
        )}
      </View>

      {/* Stats Bar */}
      {stats && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsBar}>
          {Object.entries(stats.roleCounts || {}).map(([role, count]) => (
            <View key={role} style={styles.statBadge}>
              <View style={[styles.statDot, { backgroundColor: ROLE_COLOR_MAP[role] || '#636366' }]} />
              <Text style={styles.statText}>{role}: {count as number}</Text>
            </View>
          ))}
          <View style={styles.statBadge}>
            <Text style={styles.statText}>Gems: {stats.totalGemsInCirculation}</Text>
          </View>
        </ScrollView>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#636366"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable onPress={handleSearch} style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {/* Role Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <Pressable
          onPress={() => handleRoleFilter(null)}
          style={[styles.filterChip, !roleFilter && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, !roleFilter && styles.filterChipTextActive]}>
            All
          </Text>
        </Pressable>
        {ROLES.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => handleRoleFilter(r.id)}
            style={[styles.filterChip, roleFilter === r.id && styles.filterChipActive]}
          >
            <Text style={[
              styles.filterChipText,
              roleFilter === r.id && styles.filterChipTextActive,
            ]}>
              {r.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color="#7DD3FC" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>No users found</Text>
          )
        }
        ListFooterComponent={
          isLoading && users.length > 0 ? (
            <ActivityIndicator size="small" color="#7DD3FC" style={{ padding: 20 }} />
          ) : null
        }
      />

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onAction={handleAction}
        />
      )}
    </View>
  );
}

// ─── User Detail Modal ──────────────────────────────────────────────────────

function UserDetailModal({
  user,
  onClose,
  onAction,
}: {
  user: ManagedUser;
  onClose: () => void;
  onAction: (action: string, userId: string, payload?: any) => void;
}) {
  const [gemAmount, setGemAmount] = useState('');
  const [banReason, setBanReason] = useState('');
  const [newRole, setNewRole] = useState<string>(user.role);

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{user.displayName || user.username}</Text>
                <Text style={styles.modalSubtitle}>{user.email}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>

            {/* Status */}
            <View style={styles.modalSection}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Role</Text>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR_MAP[user.role] || '#636366' }]}>
                  <Text style={styles.roleBadgeText}>{user.role}</Text>
                </View>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Status</Text>
                <Text style={styles.modalValue}>{user.status}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Tier</Text>
                <Text style={styles.modalValue}>{user.tier}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Gems</Text>
                <Text style={[styles.modalValue, { color: '#7DD3FC' }]}>{user.gemBalance}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Trust Score</Text>
                <Text style={[styles.modalValue, {
                  color: user.trustScore > 50 ? '#34C759' : user.trustScore > 20 ? '#FF9500' : '#FF3B30',
                }]}>{user.trustScore}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Streak</Text>
                <Text style={styles.modalValue}>{user.currentStreak} days</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Posts</Text>
                <Text style={styles.modalValue}>{user.totalPosts}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Votes Received</Text>
                <Text style={styles.modalValue}>{user.totalVotesReceived}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Reports</Text>
                <Text style={[styles.modalValue, {
                  color: user.reportCount > 5 ? '#FF3B30' : '#E5E5EA',
                }]}>{user.reportCount}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Referral Code</Text>
                <Text style={styles.modalValue}>{user.referralCode}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Referrals</Text>
                <Text style={styles.modalValue}>{user.referralCount}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Joined</Text>
                <Text style={styles.modalValue}>
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              {user.bannedAt ? (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Ban Reason</Text>
                  <Text style={[styles.modalValue, { color: '#FF3B30' }]}>{user.banReason}</Text>
                </View>
              ) : null}
              {user.notes ? (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Notes</Text>
                  <Text style={[styles.modalValue, { flex: 1 }]} numberOfLines={3}>{user.notes}</Text>
                </View>
              ) : null}
            </View>

            {/* Actions */}
            <Text style={styles.actionsTitle}>Actions</Text>

            {/* Change Role */}
            <View style={styles.actionSection}>
              <Text style={styles.actionLabel}>Change Role</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => setNewRole(r.id)}
                    style={[
                      styles.roleOption,
                      newRole === r.id && { backgroundColor: r.color + '33', borderColor: r.color },
                    ]}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      newRole === r.id && { color: r.color },
                    ]}>{r.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {newRole !== user.role && (
                <Pressable
                  onPress={() => onAction('role', user.id, { role: newRole })}
                  style={styles.applyBtn}
                >
                  <Text style={styles.applyBtnText}>Apply Role Change</Text>
                </Pressable>
              )}
            </View>

            {/* Adjust Gems */}
            <View style={styles.actionSection}>
              <Text style={styles.actionLabel}>Adjust Gems</Text>
              <View style={styles.gemRow}>
                <TextInput
                  style={styles.gemInput}
                  value={gemAmount}
                  onChangeText={setGemAmount}
                  placeholder="e.g. 100 or -50"
                  placeholderTextColor="#636366"
                  keyboardType="numeric"
                />
                <Pressable
                  onPress={() => {
                    const amt = parseInt(gemAmount);
                    if (isNaN(amt)) return Alert.alert('Error', 'Enter a valid number');
                    onAction('gems', user.id, { amount: amt, reason: 'Admin adjustment via control panel' });
                    setGemAmount('');
                  }}
                  style={styles.gemBtn}
                >
                  <Text style={styles.gemBtnText}>Apply</Text>
                </Pressable>
              </View>
            </View>

            {/* Ban / Unban */}
            <View style={styles.actionSection}>
              {!user.bannedAt ? (
                <>
                  <Text style={styles.actionLabel}>Ban User</Text>
                  <TextInput
                    style={styles.banInput}
                    value={banReason}
                    onChangeText={setBanReason}
                    placeholder="Reason for ban..."
                    placeholderTextColor="#636366"
                  />
                  <View style={styles.banActions}>
                    {['1h', '24h', '7d', '30d', 'permanent'].map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => {
                          if (!banReason.trim()) return Alert.alert('Error', 'Enter a ban reason');
                          Alert.alert('Confirm Ban', `Ban this user for ${d}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Ban', style: 'destructive', onPress: () => onAction('ban', user.id, { reason: banReason, duration: d }) },
                          ]);
                        }}
                        style={styles.banBtn}
                      >
                        <Text style={styles.banBtnText}>{d}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => onAction('unban', user.id)}
                  style={styles.unbanBtn}
                >
                  <Text style={styles.unbanBtnText}>Unban User</Text>
                </Pressable>
              )}
            </View>

            {/* Shadow Ban */}
            <Pressable
              onPress={() => onAction('shadow_ban', user.id)}
              style={styles.shadowBanBtn}
            >
              <Text style={styles.shadowBanBtnText}>
                {user.shadowBanned ? 'Remove Shadow Ban' : 'Shadow Ban'}
              </Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={() => {
                Alert.alert('Delete User', 'This will soft-delete the user. Continue?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onAction('delete', user.id) },
                ]);
              }}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Delete User</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  totalCount: { color: '#8E8E93', fontSize: 14 },

  statsBar: { paddingHorizontal: 16, marginBottom: 8, flexGrow: 0, maxHeight: 34 },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  statDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statText: { color: '#8E8E93', fontSize: 11, fontWeight: '600' },

  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  searchBtn: { backgroundColor: '#7DD3FC', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#0D0D0F', fontWeight: '700', fontSize: 13 },

  filterRow: { paddingHorizontal: 16, marginBottom: 12, flexGrow: 0, maxHeight: 36 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: 'rgba(125, 211, 252, 0.2)' },
  filterChipText: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#7DD3FC' },

  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  userCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  userCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userCardRight: {},
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  userName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  userEmail: { color: '#636366', fontSize: 12, marginTop: 4 },
  userStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  userStat: { color: '#8E8E93', fontSize: 11 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyText: { color: '#636366', textAlign: 'center', marginTop: 40, fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  modalSubtitle: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  modalClose: { padding: 8 },
  modalCloseText: { color: '#7DD3FC', fontWeight: '600' },
  modalSection: { marginBottom: 20 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  modalLabel: { color: '#8E8E93', fontSize: 13 },
  modalValue: { color: '#E5E5EA', fontSize: 13, fontWeight: '600' },

  actionsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  actionSection: { marginBottom: 16 },
  actionLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600', marginBottom: 8 },

  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginRight: 8,
  },
  roleOptionText: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  applyBtn: { backgroundColor: '#7DD3FC', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  applyBtnText: { color: '#0D0D0F', fontWeight: '700', fontSize: 13 },

  gemRow: { flexDirection: 'row', gap: 8 },
  gemInput: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  gemBtn: { backgroundColor: '#7DD3FC', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  gemBtnText: { color: '#0D0D0F', fontWeight: '700' },

  banInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  banActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  banBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 8,
  },
  banBtnText: { color: '#FF3B30', fontSize: 12, fontWeight: '600' },
  unbanBtn: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unbanBtnText: { color: '#34C759', fontWeight: '700' },
  shadowBanBtn: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  shadowBanBtnText: { color: '#FF9500', fontWeight: '700' },
  deleteBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  deleteBtnText: { color: '#FF3B30', fontWeight: '700' },
});
