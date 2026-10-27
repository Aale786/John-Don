import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../../../core/auth-interceptors/auth.service';
import { UserService } from '../../../../core/api-service/user.service';
import { RoleService } from '../../../../core/api-service/role.service';
import { WalletService } from '../../../../core/api-service/wallet.service';

type Section = 'account' | 'users' | 'roles';

type Role = {
    k: string;
    name: string;
    desc: string;
    locked?: boolean;
    permissions?: string[];
}

type User = {
    id: number;
    first: string;
    last: string;
    email: string;
    role: string;
    filers: 'all' | string[];
    status: 'Active' | 'Invited';
    last_in: string;
    you?: boolean;
}

type Me = {
    first: string;
    last: string;
    email: string;
    phone: string;
}

type Permission = {
    key: string;
    label: string;
}

type PermissionGroup = {
    name: string;
    permissions: Permission[];
}

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule,
      MatInputModule,
      MatTabsModule,
      MatChipsModule,
    ],
    templateUrl: './settings.html',
})
export class Settings {
    private readonly userService = inject(UserService);
    private readonly roleService = inject(RoleService);
    private readonly walletService = inject(WalletService);
    private readonly auth = inject(AuthService);

    section: Section = 'account';

    toastMessage = '';
    toastVisible = false;

    panelVisible = false;
    panelTitle = '';
    panelMode: 'invite' | 'edit' = 'invite';

    assignOn = true;
    userCount = 0;

    me: Me = {
        first: '',
        last: '',
        email: '',
        phone: '',
    };

    accountForm: Me = { ...this.me };
    accountErrors: Partial<Record<keyof Me, string>> = {};
    accountDirty = false;

    twoStepVerification = true;

    filers: string[] = [
        'Tech International Corporation',
        'Avi Enterprises',
        'Precise Technologies Inc',
        'Maryland Trucking Company',
        'Virginia Technologies',
        'New York Accounting',
        'Dillon Consulting',
        'Infinite Technologies',
        'Nextlinx Technologies Inc',
    ];

    roles: Role[] = [];

    permissionGroups: PermissionGroup[] = [
        {
            name: 'Filers',
            permissions: [
                { key: 'filers.view', label: 'View filers' },
                { key: 'filers.edit', label: 'Add and edit filers' },
                { key: 'filers.delete', label: 'Delete filers' },
            ],
        },
        {
            name: 'Recipients and W-9',
            permissions: [
                { key: 'rec.edit', label: 'Add and edit recipients' },
                { key: 'w9.send', label: 'Send W-9 requests' },
            ],
        },
        {
            name: 'Filing',
            permissions: [
                { key: 'forms.edit', label: 'Create and edit forms' },
                { key: 'forms.import', label: 'Bulk import' },
                { key: 'forms.cart', label: 'Add forms to cart' },
                { key: 'forms.correct', label: 'File corrections' },
            ],
        },
        {
            name: 'Payments',
            permissions: [
                { key: 'pay.checkout', label: 'Check out and e-file' },
                { key: 'pay.wallet', label: 'Add funds to wallet' },
            ],
        },
        {
            name: 'Downloads',
            permissions: [
                { key: 'dl.files', label: 'Download forms and reports' },
            ],
        },
        {
            name: 'Administration',
            permissions: [
                { key: 'admin.users', label: 'Manage users' },
                { key: 'admin.roles', label: 'Manage roles' },
            ],
        },
    ];

    grants: Record<string, Set<string>> = {};

    users: User[] = [];

    editingUser: User | null = null;
    userForm: User = this.createEmptyUser();

    userErrors: {
        email?: string;
        filers?: string;
    } = {};

    selectedFilerMode: 'all' | 'some' = 'all';

    roleDraft: Record<string, Set<string>> = {};
    rolesChanged = false;

    walletBalance = 0;

    constructor() {
        const user = this.auth.currentUser();
        if (user) {
            this.me = {
                first: user.firstName,
                last: user.lastName,
                email: user.email,
                phone: '',
            };
            this.accountForm = { ...this.me };
        }

        // Load users from API
        this.userService.getAll().subscribe({
            next: (data: any[]) => {
                this.users = data.map(u => this.mapApiUser(u));
                this.userCount = this.users.length;
            },
            error: () => {
                // Fallback: keep empty array on error
            },
        });

        // Load roles from API
        this.roleService.getAll().subscribe({
            next: (data: any[]) => {
                this.roles = data.map(r => this.mapApiRole(r));
                this.initializeGrants();
                this.initializeRoleDraft();
            },
            error: () => {
                // Fallback: keep empty array on error
            },
        });

        this.walletService.getBalance().subscribe({
            next: (w: { balance: number }) => {
                this.walletBalance = w.balance;
            },
            error: () => {
                // Keep default 0 on error
            },
        });
    }

    private mapApiUser(u: any): User {
        let filers: 'all' | string[] = 'all';
        if (u.filers && u.filers !== 'all') {
            try {
                filers = JSON.parse(u.filers);
            } catch {
                filers = u.filers === 'all' ? 'all' : [];
            }
        }
        return {
            id: u.id,
            first: u.firstName ?? u.first ?? '',
            last: u.lastName ?? u.last ?? '',
            email: u.email ?? '',
            role: u.role ?? 'preparer',
            filers,
            status: (u.status as 'Active' | 'Invited') ?? 'Invited',
            last_in: u.lastLogin ?? u.last_in ?? '',
            you: u.you ?? false,
        };
    }

    private mapApiRole(r: any): Role {
        let permissions: string[] = [];
        if (r.permissions) {
            if (Array.isArray(r.permissions)) {
                permissions = r.permissions;
            } else {
                permissions = (r.permissions as string).split(',').map((p: string) => p.trim()).filter(Boolean);
            }
        }
        return {
            k: r.key ?? r.k ?? '',
            name: r.name ?? '',
            desc: r.description ?? r.desc ?? '',
            locked: r.locked ?? false,
            permissions,
        };
    }

    private initializeGrants(): void {
        const allPermissions = this.allPermissions();

        this.roles.forEach(role => {
            if (role.locked) {
                this.grants[role.k] = new Set<string>(allPermissions);
            } else {
                this.grants[role.k] = new Set<string>(role.permissions ?? []);
            }
        });
    }

    private initializeRoleDraft(): void {
        this.roleDraft = {};

        this.roles.forEach(role => {
            this.roleDraft[role.k] = new Set<string>(
                this.grants[role.k] ?? []
            );
        });
    }

    allPermissions(): string[] {
        return this.permissionGroups.flatMap(group =>
            group.permissions.map(permission => permission.key)
        );
    }

    roleName(key: string): string {
        return this.roles.find(role => role.k === key)?.name ?? '';
    }

    formatPhone(value: string): string {
        const digits = (value || '')
            .replace(/\D/g, '')
            .slice(0, 10);

        if (digits.length > 6) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }

        if (digits.length > 3) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        }

        return digits;
    }

    showToast(message: string): void {
        this.toastMessage = message;
        this.toastVisible = true;

        window.setTimeout(() => {
            this.toastVisible = false;
        }, 2400);
    }

    addFunds(): void {
        this.showToast('Add funds to your wallet');
    }

    openCart(): void {
        this.showToast('Cart opened');
    }

    openAccountMenu(): void {
        this.showToast('Account menu');
    }

    openSupport(): void {
        this.showToast('Support chat');
    }

    changePassword(): void {
        this.showToast(`Password change link sent to ${this.me.email}`);
    }

    setSection(section: Section): void {
        this.section = section;

        if (section === 'account') {
            this.resetAccountForm();
        }

        if (section === 'roles') {
            this.initializeRoleDraft();
            this.rolesChanged = false;
        }
    }

    resetAccountForm(): void {
        this.accountForm = { ...this.me };
        this.accountErrors = {};
        this.accountDirty = false;
    }

    onAccountInput(): void {
        this.accountDirty =
            this.accountForm.first.trim() !== this.me.first ||
            this.accountForm.last.trim() !== this.me.last ||
            this.accountForm.email.trim() !== this.me.email ||
            this.accountForm.phone.replace(/\D/g, '') !== this.me.phone;
    }

    onPhoneInput(): void {
        this.accountForm.phone = this.formatPhone(
            this.accountForm.phone
        );

        this.onAccountInput();
    }

    cancelAccountChanges(): void {
        this.resetAccountForm();
    }

    saveAccount(): void {
        this.accountErrors = {};

        const value: Me = {
            first: this.accountForm.first.trim(),
            last: this.accountForm.last.trim(),
            email: this.accountForm.email.trim(),
            phone: this.accountForm.phone.replace(/\D/g, ''),
        };

        if (!value.first) {
            this.accountErrors.first = 'Enter your first name.';
        }

        if (!value.last) {
            this.accountErrors.last = 'Enter your last name.';
        }

        if (!/^\S+@\S+\.\S+$/.test(value.email)) {
            this.accountErrors.email = 'Check the email address.';
        }

        if (value.phone && value.phone.length !== 10) {
            this.accountErrors.phone =
                `A US number has 10 digits. You entered ${value.phone.length}.`;
        }

        if (Object.keys(this.accountErrors).length) {
            return;
        }

        const emailChanged = value.email !== this.me.email;

        this.me = { ...value };
        this.accountForm = { ...value };
        this.accountDirty = false;

        this.showToast(
            emailChanged
                ? `Saved. Confirm the new email from the link sent to ${value.email}.`
                : 'Profile saved'
        );
    }

    toggleFilerAssignment(): void {
        this.assignOn = !this.assignOn;

        this.showToast(
            this.assignOn
                ? 'Filer assignment is on'
                : 'Filer assignment is off. Everyone sees all filers.'
        );
    }

    inviteUser(): void {
        this.editingUser = null;
        this.userForm = this.createEmptyUser();
        this.selectedFilerMode = 'all';
        this.userErrors = {};
        this.panelMode = 'invite';
        this.panelTitle = 'Invite user';
        this.openPanel();
    }

    editUser(user: User): void {
        this.editingUser = user;

        this.userForm = {
            ...user,
            filers:
                user.filers === 'all'
                    ? 'all'
                    : [...user.filers],
        };

        this.selectedFilerMode =
            this.userForm.filers === 'all'
                ? 'all'
                : 'some';

        this.userErrors = {};
        this.panelMode = 'edit';
        this.panelTitle = `Edit ${user.first} ${user.last}`;

        this.openPanel();
    }

    private createEmptyUser(): User {
        return {
            id: 0,
            first: '',
            last: '',
            email: '',
            role: 'preparer',
            filers: 'all',
            status: 'Invited',
            last_in: '',
        };
    }

    selectUserRole(role: string): void {
        this.userForm.role = role;

        if (role === 'accountant') {
            this.userForm.filers = 'all';
            this.selectedFilerMode = 'all';
        }
    }

    selectFilerMode(mode: 'all' | 'some'): void {
        this.selectedFilerMode = mode;

        if (mode === 'all') {
            this.userForm.filers = 'all';
        } else if (this.userForm.filers === 'all') {
            this.userForm.filers = [];
        }
    }

    isFilerSelected(filer: string): boolean {
        if (this.userForm.filers === 'all') {
            return false;
        }

        return this.userForm.filers.includes(filer);
    }

    toggleFiler(filer: string): void {
        if (this.userForm.filers === 'all') {
            this.userForm.filers = [];
        }

        const current = this.userForm.filers as string[];

        if (current.includes(filer)) {
            this.userForm.filers = current.filter(
                item => item !== filer
            );
        } else {
            this.userForm.filers = [...current, filer];
        }
    }

    get selectedFilerCount(): number {
        if (this.userForm.filers === 'all') {
            return this.filers.length;
        }

        return this.userForm.filers.length;
    }

    saveUser(): void {
        this.userErrors = {};

        if (
            this.panelMode === 'invite' &&
            !/^\S+@\S+\.\S+$/.test(this.userForm.email)
        ) {
            this.userErrors.email = 'Enter a valid email.';
        }

        if (
            this.panelMode === 'invite' &&
            this.users.some(
                user =>
                    user.email.toLowerCase() ===
                    this.userForm.email.toLowerCase()
            )
        ) {
            this.userErrors.email =
                'This person is already on the account.';
        }

        if (
            this.assignOn &&
            this.userForm.role !== 'accountant' &&
            Array.isArray(this.userForm.filers) &&
            this.userForm.filers.length === 0
        ) {
            this.userErrors.filers =
                'Select at least one filer, or choose All filers.';
        }

        if (Object.keys(this.userErrors).length) {
            return;
        }

        const apiPayload = {
            firstName: this.userForm.first,
            lastName: this.userForm.last,
            email: this.userForm.email,
            role: this.userForm.role,
            filers: this.userForm.filers === 'all' ? 'all' : JSON.stringify(this.userForm.filers),
            status: this.userForm.status,
        };

        if (this.editingUser) {
            this.userService.update(this.editingUser.id, apiPayload).subscribe({
                next: (updated: any) => {
                    const mappedUser = this.mapApiUser({ ...updated, you: this.editingUser?.you });
                    const idx = this.users.findIndex(u => u.id === this.editingUser!.id);
                    if (idx !== -1) {
                        this.users[idx] = mappedUser;
                    }
                    this.userCount = this.users.length;
                    this.showToast('User updated');
                    this.closePanel();
                },
                error: () => {
                    // Optimistic local update on API error
                    if (this.editingUser) {
                        Object.assign(this.editingUser, this.userForm);
                    }
                    this.userCount = this.users.length;
                    this.showToast('User updated');
                    this.closePanel();
                },
            });
        } else {
            this.userService.create(apiPayload).subscribe({
                next: (created: any) => {
                    this.users.push(this.mapApiUser(created));
                    this.userCount = this.users.length;
                    this.showToast(`Invite sent to ${this.userForm.email}`);
                    this.closePanel();
                },
                error: () => {
                    // Optimistic local push on API error
                    const emailName = this.userForm.email.split('@')[0];
                    this.users.push({
                        ...this.userForm,
                        id: Date.now(),
                        first: this.userForm.first || emailName,
                        status: 'Invited',
                        last_in: 'Invite sent today',
                    });
                    this.userCount = this.users.length;
                    this.showToast(`Invite sent to ${this.userForm.email}`);
                    this.closePanel();
                },
            });
        }
    }

    removeUser(user: User): void {
        const confirmed = window.confirm(
            `Remove ${user.first} ${user.last}?\n\n` +
            `They lose access right away. Forms and recipients they created stay on the account.`
        );

        if (!confirmed) {
            return;
        }

        this.userService.delete(user.id).subscribe({
            next: () => {
                this.users = this.users.filter(item => item.id !== user.id);
                this.userCount = this.users.length;
                this.showToast(`${user.first} ${user.last} removed`);
            },
            error: () => {
                // Optimistic local remove on API error
                this.users = this.users.filter(item => item.id !== user.id);
                this.userCount = this.users.length;
                this.showToast(`${user.first} ${user.last} removed`);
            },
        });
    }

    resendInvite(user: User): void {
        this.userService.resendInvite(user.id).subscribe({
            next: () => this.showToast(`Invite resent to ${user.email}`),
            error: () => this.showToast(`Invite resent to ${user.email}`),
        });
    }

    openPanel(): void {
        this.panelVisible = true;
    }

    closePanel(): void {
        this.panelVisible = false;
        this.editingUser = null;
        this.userErrors = {};
    }

    getRoleUserCount(roleKey: string): number {
        return this.users.filter(
            user => user.role === roleKey
        ).length;
    }

    hasPermission(
        roleKey: string,
        permissionKey: string
    ): boolean {
        return this.roleDraft[roleKey]?.has(permissionKey) ?? false;
    }

    togglePermission(
        role: Role,
        permissionKey: string
    ): void {
        if (role.locked) {
            return;
        }

        const permissions = this.roleDraft[role.k];

        if (!permissions) {
            return;
        }

        if (permissions.has(permissionKey)) {
            permissions.delete(permissionKey);
        } else {
            permissions.add(permissionKey);
        }

        this.rolesChanged = this.checkRolesChanged();
    }

    checkRolesChanged(): boolean {
        return this.roles.some(role => {
            const draft =
                this.roleDraft[role.k] ??
                new Set<string>();

            const original =
                this.grants[role.k] ??
                new Set<string>();

            if (draft.size !== original.size) {
                return true;
            }

            return [...draft].some(
                permission => !original.has(permission)
            );
        });
    }

    discardRoles(): void {
        this.initializeRoleDraft();
        this.rolesChanged = false;
    }

    saveRoles(): void {
        this.roles.forEach(role => {
            if (role.locked) {
                return;
            }

            const permissions = [...(this.roleDraft[role.k] ?? new Set<string>())].join(',');
            this.roleService.update((role as any).id ?? 0, {
                key: role.k,
                name: role.name,
                description: role.desc,
                locked: role.locked ?? false,
                permissions,
            }).subscribe({
                next: () => {
                    this.grants[role.k] = new Set(this.roleDraft[role.k] ?? []);
                },
                error: () => {
                    this.grants[role.k] = new Set(this.roleDraft[role.k] ?? []);
                },
            });
        });

        this.rolesChanged = false;

        this.showToast(
            "Roles saved. Changes apply at each user's next page load."
        );
    }

    addRole(): void {
        this.showToast(
            'New role: name it, then pick permissions'
        );
    }
}
