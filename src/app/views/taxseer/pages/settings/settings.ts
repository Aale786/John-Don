import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';

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
    section: Section = 'account';

    toastMessage = '';
    toastVisible = false;

    panelVisible = false;
    panelTitle = '';
    panelMode: 'invite' | 'edit' = 'invite';

    assignOn = true;
    userCount = 0;

    me: Me = {
        first: 'Mary',
        last: 'Jane',
        email: 'maryp@csnizz.com',
        phone: '2407516035',
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

    roles: Role[] = [
        {
            k: 'accountant',
            name: 'Accountant',
            desc: 'Full access, including payments and managing users.',
            locked: true,
            permissions: [],
        },
        {
            k: 'preparer',
            name: 'Preparer',
            desc: "Enters and imports data. Can't pay or manage users.",
            permissions: [
                'filers.view',
                'filers.edit',
                'rec.edit',
                'w9.send',
                'forms.edit',
                'forms.import',
                'dl.files',
            ],
        },
        {
            k: 'reviewer',
            name: 'Reviewer',
            desc: "Reviews forms and adds them to the cart. Can't pay.",
            permissions: [
                'filers.view',
                'rec.edit',
                'w9.send',
                'forms.edit',
                'forms.cart',
                'forms.correct',
                'dl.files',
            ],
        },
        {
            k: 'viewer',
            name: 'Viewer',
            desc: 'Read only. Can download filed forms.',
            permissions: [
                'filers.view',
                'dl.files',
            ],
        },
    ];

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

    grants: Record<string, Set<string>> = {
        accountant: new Set<string>(),
        preparer: new Set<string>(),
        reviewer: new Set<string>(),
        viewer: new Set<string>(),
    };

    users: User[] = [
        {
            id: 1,
            first: 'Mary',
            last: 'Jane',
            email: 'maryp@csnizz.com',
            role: 'accountant',
            filers: 'all',
            status: 'Active',
            last_in: 'Today, 9:14 AM',
            you: true,
        },
        {
            id: 2,
            first: 'Raj',
            last: 'Mehta',
            email: 'raj.mehta@csnizz.com',
            role: 'preparer',
            filers: [
                'Maryland Trucking Company',
                'Nextlinx Technologies Inc',
                'New York Accounting',
            ],
            status: 'Active',
            last_in: 'Yesterday',
        },
        {
            id: 3,
            first: 'Ana',
            last: 'Lopez',
            email: 'ana.lopez@csnizz.com',
            role: 'reviewer',
            filers: 'all',
            status: 'Active',
            last_in: 'Jan 9, 2026',
        },
        {
            id: 4,
            first: 'Sam',
            last: 'Turner',
            email: 'sam@turnercpa.example',
            role: 'viewer',
            filers: ['Tech International Corporation'],
            status: 'Invited',
            last_in: 'Invite sent Jan 12',
        },
    ];

    editingUser: User | null = null;
    userForm: User = this.createEmptyUser();

    userErrors: {
        email?: string;
        filers?: string;
    } = {};

    selectedFilerMode: 'all' | 'some' = 'all';

    roleDraft: Record<string, Set<string>> = {};
    rolesChanged = false;

    constructor() {
        this.initializeGrants();
        this.userCount = this.users.length;
        this.initializeRoleDraft();
    }

    private initializeGrants(): void {
        const allPermissions = this.allPermissions();

        this.grants['accountant'] = new Set<string>(allPermissions);

        this.roles.forEach(role => {
            if (role.k !== 'accountant') {
                this.grants[role.k] = new Set<string>(
                    role.permissions ?? []
                );
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

        if (this.editingUser) {
            Object.assign(this.editingUser, this.userForm);
            this.showToast('User updated');
        } else {
            const emailName =
                this.userForm.email.split('@')[0];

            this.users.push({
                ...this.userForm,
                id: Date.now(),
                first: this.userForm.first || emailName,
                status: 'Invited',
                last_in: 'Invite sent today',
            });

            this.showToast(
                `Invite sent to ${this.userForm.email}`
            );
        }

        this.userCount = this.users.length;
        this.closePanel();
    }

    removeUser(user: User): void {
        const confirmed = window.confirm(
            `Remove ${user.first} ${user.last}?\n\n` +
            `They lose access right away. Forms and recipients they created stay on the account.`
        );

        if (!confirmed) {
            return;
        }

        this.users = this.users.filter(
            item => item.id !== user.id
        );

        this.userCount = this.users.length;

        this.showToast(
            `${user.first} ${user.last} removed`
        );
    }

    resendInvite(user: User): void {
        this.showToast(`Invite resent to ${user.email}`);
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
            this.grants[role.k] = new Set(
                this.roleDraft[role.k] ?? []
            );
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
