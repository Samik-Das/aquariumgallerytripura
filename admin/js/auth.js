// Auth state management
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signUp(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

// Auth state listener
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' && !window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html';
  }
});
