# Költségkövető

Személyes pénzügyeidet nyomon követő webalkalmazás — kategóriák, több fiók (Revolut, OTP,
készpénz stb.), átvezetések, automatikus levonások, naptár nézet, statisztikák és havi büdzsé.
Csak te férsz hozzá a saját adataidhoz.

## Mielőtt elkezdenéd

Három ingyenes fiókra lesz szükséged:

1. **[github.com](https://github.com)** — ide kerül a kód
2. **[supabase.com](https://supabase.com)** — ez lesz az adatbázisod és a bejelentkezés-kezelésed
3. **[vercel.com](https://vercel.com)** — ez teszi élővé a weboldalt

Regisztrálhatsz mindegyikre a GitHub fiókoddal is (egy kattintás), ha van már ilyened.

---

## 1. lépés — Supabase projekt létrehozása

1. Jelentkezz be a [supabase.com](https://supabase.com) oldalon, kattints **"New project"**.
2. Adj neki egy nevet (pl. `koltsegkovetes`), válassz egy jelszót az adatbázishoz (ezt mentsd el),
   és válaszd a hozzád legközelebbi régiót (pl. Frankfurt).
3. Várj 1-2 percet, amíg a projekt elkészül.
4. A bal oldali menüben nyisd meg az **SQL Editor**-t, kattints **"New query"**, majd másold be
   a `supabase/schema.sql` fájl **teljes tartalmát**, és nyomj **Run**-t. Ez létrehozza az összes
   táblát és a biztonsági szabályokat (Row Level Security), amik garantálják, hogy más
   felhasználó soha ne lássa a te adataidat.
5. A bal oldali menüben menj a **Project Settings > API** oldalra. Itt találod:
   - **Project URL** → ez lesz a `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** kulcs → ez lesz a `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Másold ki mindkettőt, később szükséged lesz rájuk.

6. Még egy fontos beállítás: **Authentication > Sign In / Providers > Email** alatt, ha nem
   szeretnél e-mail megerősítést a regisztrációnál (gyorsabb teszteléshez), kapcsold ki a
   **"Confirm email"** opciót. Éles használatra ajánlott bekapcsolva hagyni.
7. **Authentication > URL Configuration** alatt állítsd be a **Site URL**-t a majdani Vercel
   címedre (ezt a 3. lépés után fogod tudni pontosan kitölteni, egyelőre kihagyhatod).

---

## 2. lépés — Kód feltöltése GitHub-ra

Ha még nincs Git a gépeden, a legegyszerűbb, ha a GitHub weboldalán keresztül töltöd fel:

1. Hozz létre egy új, **privát** repository-t a [github.com/new](https://github.com/new) oldalon
   (pl. `koltsegkovetes`). **Fontos: állítsd "Private"-ra**, hogy a kódod ne legyen nyilvános.
2. Töltsd le ezt a projektet (a lenti letöltési linkről), és tömörítsd ki.
3. A GitHub repository oldalán kattints **"uploading an existing file"**, és húzd be az összes
   fájlt és mappát (a `node_modules` mappát, ha lenne, NE töltsd fel — ez nincs is a csomagban).
4. Commitold ("Commit changes").

*(Ha van tapasztalatod a terminállal, ez természetesen `git init`, `git add .`, `git commit`,
`git push` paranccsal is megy — ez csak a leggyorsabb út, ha még sosem használtál Git-et.)*

---

## 3. lépés — Telepítés Vercel-re

1. Jelentkezz be a [vercel.com](https://vercel.com) oldalon a GitHub fiókoddal.
2. Kattints **"Add New… > Project"**, és válaszd ki az imént feltöltött `koltsegkovetes`
   repository-t.
3. A **"Environment Variables"** résznél add hozzá a Supabase-től kapott két értéket:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | *(a Supabase Project URL-ed)* |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(a Supabase anon public kulcsod)* |

4. Kattints **"Deploy"**. Kb. 1-2 perc múlva megkapod a saját webcímedet
   (pl. `koltsegkovetes.vercel.app`).
5. Menj vissza a Supabase **Authentication > URL Configuration** oldalára, és állítsd be a
   **Site URL**-t erre a Vercel címre (pl. `https://koltsegkovetes.vercel.app`), és add hozzá a
   **Redirect URLs** listához is (`https://koltsegkovetes.vercel.app/auth/callback`).

Ezután minden alkalommal, amikor módosítod a kódot a GitHub-on, a Vercel automatikusan újra
telepíti az oldalt.

---

## 4. lépés — Első bejelentkezés

1. Nyisd meg a Vercel-es webcímedet.
2. Kattints **"Regisztráció"**, add meg az e-mail címedet és egy jelszót.
3. Ha bekapcsolva hagytad az e-mail megerősítést, nézd meg a postaládádat, és kattints a
   megerősítő linkre.
4. Jelentkezz be — kész! Hozz létre egy fiókot (pl. Készpénz), és kezdheted a rögzítést.

---

## Biztonság — hogyan védi az adataidat?

- Az app **Row Level Security**-t (RLS) használ az adatbázis szintjén: minden tábla úgy van
  beállítva, hogy egy sort *kizárólag* az a felhasználó láthat és módosíthat, aki létrehozta.
  Ez azt jelenti, hogy még ha valaki ismeri is az alkalmazás URL-jét vagy technikai
  hozzáférése van az API-hoz, bejelentkezés (a te jelszavad) nélkül semmit sem tud lekérni.
- A jelszavas bejelentkezést a Supabase kezeli, titkosítva tárolja a jelszavakat.
- Érdemes bekapcsolni a **kétlépcsős azonosítást (2FA)** a Supabase és a Vercel/GitHub
  fiókodon is, mivel ezek "kapuk" az adataidhoz.

---

## Amit tartalmaz

- ✅ Kategóriák szerinti, időszakonkénti statisztikák és diagramok, előző időszakkal
  összehasonlítva
- ✅ Több fiók kezelése (Revolut, OTP, készpénz, stb.), egyenlegekkel
- ✅ Átvezetés a fiókjaid között (nem számít bevételnek/kiadásnak)
- ✅ Alap és egyedi kategóriák
- ✅ Automatikus, ismétlődő tételek (előfizetések, fizetés)
- ✅ Naptár nézet napi költés-intenzitással és jegyzetekkel
- ✅ Jegyzet minden tételhez és naptári naphoz
- ✅ Havi büdzsé kategóriánként, vizuális jelzőgyűrűkkel
- ✅ Világos/sötét "üveg" (glassmorphism) design, telefonra optimalizálva
- ✅ Telepíthető PWA-ként a telefon kezdőképernyőjére

## Bővítési ötletek

A `supabase/schema.sql` séma előkészíti a többdevizás támogatást és a napi jegyzeteket is —
ha szeretnéd, a következő körben belevehetjük: export CSV-be, megtakarítási célok,
gyorsrögzítő gombok, push értesítések a büdzsé-limit közelítésekor.
