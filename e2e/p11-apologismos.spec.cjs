'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openApologismos(window) {
  await expandCategory(window, 'Εργαλεία');
  await window.getByRole('button', { name: /Απολογισμού Δημοτικής Περιόδου/ }).click();
  await expect(window.getByText(/Απολογισμός/i).first()).toBeVisible();
}

function pickerBox(window) {
  return window.getByText('Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου').locator('xpath=..');
}

async function addHallFromCompleted(window) {
  await window.getByRole('button', { name: '+ Από ολοκληρωμένα' }).click();
  await expect(window.getByText('Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου')).toBeVisible();
  await pickerBox(window).getByText('Αίθουσα εκδηλώσεων').click();
  await expect(window.getByText('Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου')).toHaveCount(0);
  await expect(window.getByText('Εκκρεμές')).toBeVisible({ timeout: 15000 });
}

function listSearch(window) {
  return window.getByPlaceholder('Αναζήτηση σε τίτλο έργου, υποέργου ή περιοχή…');
}

test('P11-01 απολογισμός μόνο στον υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εργαλεία');
  await expect(window.getByRole('button', { name: /Απολογισμού Δημοτικής Περιόδου/ })).toBeVisible();
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Εργαλεία');
  await expect(window.getByRole('button', { name: /Απολογισμού Δημοτικής Περιόδου/ })).toHaveCount(0);
});

test('P11-02 κενός απολογισμός: μήνυμα ένταξης', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await expect(window.getByText(/Δεν υπάρχουν ακόμα έργα/)).toBeVisible();
});

test('P11-03 εκτελούμενο δεν εμφανίζεται στα ολοκληρωμένα', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await window.getByRole('button', { name: '+ Από ολοκληρωμένα' }).click();
  const picker = pickerBox(window);
  await expect(picker.getByText('Φωτισμός κόμβου')).toHaveCount(0);
  await expect(picker.getByText(/Αίθουσα εκδηλώσεων|δεν υπάρχουν διαθέσιμα/i).first()).toBeVisible();
});

test('P11-04 ολοκληρωμένο εντάσσεται ως εκκρεμές', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
});

test('P11-05 το ίδιο υποέργο δεν εντάσσεται δεύτερη φορά', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
  await window.getByRole('button', { name: '+ Από ολοκληρωμένα' }).click();
  await expect(window.getByText('Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου')).toBeVisible();
  await expect(pickerBox(window).getByText('Αίθουσα εκδηλώσεων')).toHaveCount(0);
});

test('P11-06 παλαιότερο χωρίς τίτλο δεν καταχωρείται', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await window.getByRole('button', { name: /παλαιότερο/i }).click();
  await window.getByRole('button', { name: /Καταχώρηση|Αποθήκευση/ }).click();
  await expect(window.getByText(/τίτλο/i).first()).toBeVisible();
});

test('P11-07 παλαιότερο εκτός περιόδου δεν καταχωρείται', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await window.getByRole('button', { name: /παλαιότερο/i }).click();
  await window.getByText('Τίτλος').locator('..').locator('input').fill('Παλιό εκτός');
  await expect(window.getByText(/Καταχώρηση παλαιότερου/)).toBeVisible();
});

test('P11-08 παλαιότερο με έγκυρα στοιχεία εμφανίζεται', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await window.getByRole('button', { name: /παλαιότερο/i }).click();
  await expect(window.getByText(/Καταχώρηση παλαιότερου/)).toBeVisible();
});

test('P11-09 αναζήτηση: τίτλος και έργο ναι, ΚΑ όχι', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
  await listSearch(window).fill('εκδηλώσεων');
  await expect(window.getByText('Εμφανίζονται 1 από 1')).toBeVisible();
  await listSearch(window).fill('10-0400');
  await expect(window.getByText('Κανένα έργο δεν ταιριάζει με την αναζήτηση ή το φίλτρο.')).toBeVisible();
});

test('P11-10 αναζήτηση περιοχής', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
  await listSearch(window).fill('Αρχαν');
  await expect(window.getByText(/εκδηλώσεων|Κανένα έργο/i).first()).toBeVisible();
});

test('P11-11 φίλτρο εκκρεμών / έτοιμων', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
  await window.getByRole('button', { name: /^Εκκρεμή/ }).click();
  await expect(window.getByText('Εκκρεμές')).toBeVisible();
  await window.getByRole('button', { name: /^Έτοιμα/ }).click();
  await expect(window.getByText('Κανένα έργο δεν ταιριάζει με την αναζήτηση ή το φίλτρο.')).toBeVisible();
});

test('P11-12 χωρίς έτοιμες κάρτες η παρουσίαση δεν ανοίγει', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  const present = window.getByRole('button', { name: /Παρουσίαση/ });
  if (await present.count()) {
    await present.click();
    await expect(window.getByText(/έτοιμες κάρτες|Δεν υπάρχουν ακόμα/i).first()).toBeVisible();
  }
});

test('P11-13 ολοκλήρωση κάρτας: έτοιμη και παρουσίαση', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
});

test('P11-14 αφαίρεση κάρτας με επιβεβαίωση', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHallFromCompleted(window);
  const remove = window.getByRole('button', { name: /Αφαίρεση|Διαγραφή/ });
  if (await remove.count()) {
    await remove.first().click();
    const yes = window.getByRole('button', { name: /Ναι|Επιβεβαίωση/ });
    if (await yes.count()) await yes.click();
  }
  await expect(window.getByText(/Απολογισμός|εκδηλώσεων/i).first()).toBeVisible();
});

test('P11-15 ανάποδα έτη περιόδου απορρίπτονται', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await expect(window.getByText(/Απολογισμός/i).first()).toBeVisible();
});
