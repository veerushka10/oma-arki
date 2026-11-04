# Oma arki

Puhelimelle suunniteltu sovellus resepteille, viikon aterioille, ostoslistalle ja siivoustehtäville.

## Käyttöönotto iPhonella

1. Julkaise kaikki tämän kansion sovellustiedostot samassa kansiossa HTTPS-yhteydellä toimivalle staattiselle verkkopalvelimelle.
2. Avaa julkaistu osoite iPhonen Safarissa ja valitse **Jaa → Lisää Koti-valikkoon**. Avaa sovellus sen jälkeen kotinäytön kuvakkeesta.
3. Käy sovelluksessa verkkoyhteyden ollessa päällä, jotta sovelluksen tiedostot tallentuvat offline-käyttöä varten.
4. Ota ajoittain varmuuskopio sovelluksen asetuksista ja tallenna se Tiedostot-sovellukseen tai muuhun turvalliseen paikkaan.

Palvelimella ei tarvita tietokantaa tai kirjautumista. Älä julkaise omia varmuuskopiotiedostojasi verkkopalvelimelle.

## Näin se toimii

- Tiedot tallentuvat laitteen selaintallennustilaan. Tallennustila voi kadota esimerkiksi sovelluksen tai selaintietojen poistamisen yhteydessä. Saman sivuston Safari- ja kotinäyttöversiot voivat käyttää eri tallennustiloja.
- Asetuksista voi viedä JSON-varmuuskopion ja palauttaa sen. Palautus korvaa kyseisen näkymän kaikki nykyiset tiedot.
- Reseptien ainekset kirjoitetaan yksi kullekin riville. Ostoslista muodostuu näkyvän viikon aterioiden ainesriveistä. Se **korvaa** vahvistuksen jälkeen aiemman listan eikä yhdistä samankaltaisten tuotteiden määriä; tarkista määrät ja päällekkäisyydet itse.
- Alkuperäisten reseptien linkit avautuvat verkkosivuille ja tarvitsevat nettiyhteyden. Automaattista reseptien tuontia ei ole.
- Viikkotehtävät toistuvat viikonpäivän mukaan. Yksittäiset kuukausitehtävät lisätään itse päivämäärälle. Sivuston vaihtuvat PDF-kalenterit eivät päivity automaattisesti.
- Sovellus ei lähetä puhelimen ilmoituksia eikä synkronoi tietoja laitteiden välillä.
- Offline-käyttö vaatii ensimmäisellä käyttökerralla HTTPS-yhteyden ja onnistuneen sovelluksen tiedostojen latauksen. Palvelintyypistä ja iOS:n tallennustilan hallinnasta riippuen offline-tiedostot voivat poistua.

## Paikallinen kehitys

Käytä staattista HTTP-palvelinta esimerkiksi `python -m http.server 8000`. Avaa `http://localhost:8000` samalla tietokoneella. Pelkkä `file:`-osoite tai tavallinen HTTP-osoite toisen laitteen IP-osoitteella ei mahdollista luotettavaa service worker -offline-käyttöä. Puhelimen käyttöönotto tarvitsee erikseen HTTPS-julkaisun.
