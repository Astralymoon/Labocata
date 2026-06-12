/**
 * Authentication logic for Labocata
 */
const auth = {
    async signIn(email, password) {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password,
        });
        if (!error && data.user) {
            const isAdmin = await this.checkAdminRole(data.user.id);
            if (!isAdmin) {
                await this.signOut();
                return { data: null, error: { message: "Acceso denegado. Se requieren permisos de administrador." } };
            }
        }
        return { data, error };
    },

    async signOut() {
        const { error } = await window.supabaseClient.auth.signOut();
        window.location.href = 'login.html';
        return { error };
    },

    async getUser() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        return user;
    },

    async checkAdminRole(userId) {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !data) return false;
        return data.role === 'admin';
    },

    async requireAdmin() {
        const user = await this.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        const isAdmin = await this.checkAdminRole(user.id);
        if (!isAdmin) {
            window.location.href = 'login.html';
        }
    }
};

window.auth = auth;
