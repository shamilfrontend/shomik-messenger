<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth';

const isLogin = ref(true);
const username = ref('');
const email = ref('');
const password = ref('');

const {
  loading, error, register, login,
} = useAuth();

const handleSubmit = async (event?: Event) => {
  if (event) {
    event.preventDefault();
  }

  if (isLogin.value) {
    await login(username.value, password.value);
  } else {
    await register(username.value, email.value, password.value);
  }
};
</script>

<template>
  <div class="auth-form">
    <div class="auth-form__container">
      <h1 class="auth-form__title">{{ isLogin ? 'Вход' : 'Регистрация' }}</h1>

      <form @submit.prevent="handleSubmit" class="auth-form__form">
        <div v-if="!isLogin" class="auth-form__field">
          <label>Email</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="email@example.com"
          />
        </div>

        <div class="auth-form__field">
          <label>Username</label>
          <input
            v-model="username"
            type="text"
            required
            placeholder="username"
          />
        </div>

        <div class="auth-form__field">
          <label>Пароль</label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="••••••"
          />
        </div>

        <div v-if="error" class="auth-form__error">{{ error }}</div>

        <button type="submit" :disabled="loading" class="auth-form__button">
          {{ loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться') }}
        </button>
      </form>

      <div class="auth-form__switch">
        <span>{{ isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?' }}</span>
        <button @click="isLogin = !isLogin" class="auth-form__link">
          {{ isLogin ? 'Зарегистрироваться' : 'Войти' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.auth-form {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--bg-primary);

  &__container {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

    @media (max-width: 768px) {
      padding: 1.5rem;
      margin: 1rem;
      border-radius: 8px;
    }
  }

  &__title {
    margin-bottom: 2rem;
    text-align: center;
    color: var(--text-primary);
    font-size: 2rem;

    @media (max-width: 768px) {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
    }
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    input {
      padding: 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 1rem;

      &:focus {
        outline: none;
        border-color: var(--accent-color);
      }
    }
  }

  &__error {
    padding: 0.75rem;
    background: rgba(255, 59, 48, 0.1);
    border: 1px solid rgba(255, 59, 48, 0.3);
    border-radius: 8px;
    color: #ff3b30;
    font-size: 0.9rem;
  }

  &__button {
    padding: 0.75rem;
    background: var(--accent-color);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__switch {
    margin-top: 1.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  &__link {
    margin-left: 0.5rem;
    background: none;
    border: none;
    color: var(--accent-color);
    cursor: pointer;
    text-decoration: underline;

    &:hover {
      opacity: 0.8;
    }
  }
}
</style>
