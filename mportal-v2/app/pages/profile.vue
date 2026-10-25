<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import type { ProfileData } from '~/types/api'

useHead({ title: 'Profil – MPortal' })

const { data, refresh } = await useApiFetch<ProfileData>('/api/auth/profile')
const { fetch: refreshSession, clear } = useUserSession()
const { pending, run } = useAction()
const toast = useToast()

const profile = reactive({ firstname: '', lastname: '', bankIban: '' })
watch(
  data,
  (value) => {
    if (!value) return
    Object.assign(profile, { firstname: value.firstname, lastname: value.lastname, bankIban: value.bankIban ?? '' })
  },
  { immediate: true },
)

async function saveProfile() {
  const ok = await run('PUT', '/api/auth/profile', { ...profile, bankIban: profile.bankIban || null }, 'Profil enregistré')
  if (ok !== null) {
    await refreshSession()
    await refresh()
  }
}

const passwords = reactive({ currentPassword: '', newPassword: '', confirm: '' })
async function changePassword() {
  if (passwords.newPassword !== passwords.confirm) return toast.error('Les deux mots de passe ne correspondent pas')
  const ok = await run('POST', '/api/auth/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }, 'Mot de passe modifié')
  if (ok !== null) Object.assign(passwords, { currentPassword: '', newPassword: '', confirm: '' })
}

async function logoutAll() {
  if (!window.confirm('Déconnecter toutes les sessions, y compris celle-ci ?')) return
  const ok = await run('POST', '/api/auth/logout-all', {}, 'Toutes les sessions ont été fermées')
  if (ok !== null) {
    await clear()
    await navigateTo('/login')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Mon profil" :subtitle="data ? `${data.email} · dernière connexion ${formatDateTimeCh(data.lastLoginAt)}` : ''" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form class="card space-y-4" @submit.prevent="saveProfile">
        <h2>Informations</h2>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="pr-first">Prénom</label>
            <input id="pr-first" v-model="profile.firstname" class="input" required maxlength="100" />
          </div>
          <div>
            <label class="label" for="pr-last">Nom</label>
            <input id="pr-last" v-model="profile.lastname" class="input" required maxlength="100" />
          </div>
        </div>
        <div>
          <label class="label" for="pr-iban">IBAN personnel</label>
          <input id="pr-iban" v-model="profile.bankIban" class="input" maxlength="42" placeholder="CH.." />
          <p class="mt-1 text-xs text-muted">Sert à reconnaître automatiquement vos prélèvements dans les relevés bancaires.</p>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary" :disabled="pending">Enregistrer</button>
        </div>
      </form>

      <form class="card space-y-4" @submit.prevent="changePassword">
        <h2>Mot de passe</h2>
        <div>
          <label class="label" for="pw-current">Mot de passe actuel</label>
          <input id="pw-current" v-model="passwords.currentPassword" class="input" type="password" autocomplete="current-password" required />
        </div>
        <div>
          <label class="label" for="pw-new">Nouveau mot de passe</label>
          <input id="pw-new" v-model="passwords.newPassword" class="input" type="password" autocomplete="new-password" required minlength="12" />
          <p class="mt-1 text-xs text-muted">12 caractères minimum, avec majuscule, minuscule et chiffre. Les autres sessions seront déconnectées.</p>
        </div>
        <div>
          <label class="label" for="pw-confirm">Confirmation</label>
          <input id="pw-confirm" v-model="passwords.confirm" class="input" type="password" autocomplete="new-password" required />
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary" :disabled="pending">Changer le mot de passe</button>
        </div>
      </form>

      <div class="card space-y-3 lg:col-span-2">
        <h2>Sécurité</h2>
        <p class="text-sm text-muted">En cas de doute (appareil perdu, session oubliée), fermez toutes les sessions ouvertes.</p>
        <button class="btn-danger" :disabled="pending" @click="logoutAll"><LogOut class="size-4" /> Déconnecter tous les appareils</button>
      </div>
    </div>
  </div>
</template>
