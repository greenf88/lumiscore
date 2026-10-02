// Explicit, record-by-record editorial corrections after reading all 1,000 entries.
// AI book knowledge, NOT publisher certification or Taxonomy V2 HIGH evidence.
// IDs select reviewed records; they are never rankings or classification heuristics.
export const categoryCorrections = {
  science: '16 17 217 236 758',
  philosophy: '19 28 208 215 216 218 228 230 233 237 977 982 989',
  society: '29 31 54 67 205 223 232 238 242 243 245 251 253 612 659 963 971 972 973 980 981 985 996 999',
  economics: '32 40 72 75 76 78 80 81 206 220 224 227 244 970 976 983 993 1000',
  psychology: '46 58 61 70 73 77 79 201 202 203 207 209 210 211 212 213 214 219 221 222 225 226 229 231 234 235 375 966 967 968 974 978 984 987 988 990 994 997 998',
  arts: '41 47 374 493 992',
  travel: '49 240 372',
  history: '34 60 62 71 239 241 246 247 248 250 252 370 371 969 975',
  biography: '129 249 373 415 581',
  true_crime: '687 701 704 711 736 742 747 775 783 786',
  sf: '90 92 95 99 102 107 108 109 114 115 116 122 126 128 131 132 136 139 141 143 144 145 150 151 160 163 169 171 184 186 193 195 196 197 198 200 304 320 344 345 351 352 382 438 479 480 507 541 551',
  fantasy: '305 310 322 323 328 329 333 335 337 339 340 342 343 346 347 357 366 367 383 430 450 462 511 513 517 526 531 557 562 572 600 630 639 641 645 767 826 892 894 923',
  literary: '94 104 130 134 182 187 194 204 256 260 261 264 265 267 270 271 272 273 277 280 281 282 284 290 293 295 299 301 303 326 350 363 369 683 743 809 815 827 833 841 842 847 853 856 859 862 868 869 870 875 878 889 891 898 904 927 934 936 938 956',
  mystery: '105 263 362 378 409 546 579 595 611 647 648 651 652 653 654 665 680 684 685 688 690 693 702 705 709 710 713 714 715 717 721 724 732 733 739 750 751 752 754 761 762 763 764 765 776 777 778 779 780 782 787 788 790 794 798 802 804 810 812 872',
  thriller: '332 353 365 407 423 460 477 486 646 881 887',
  historical: '387 411 422 429 435 439 443 459 461 472 475 481 487 547 559 566 571 573 627 640',
  horror: '426 474',
  romance: '307 313 318 327 338 356 364 614 662 679 708 729 937 955',
  feelgood: '860 873 877 916',
};
export const years = {
  2:1985,4:1995,17:2018,20:1993,32:2004,34:2004,36:1997,38:2010,39:2014,40:2013,43:1925,55:1947,57:2010,59:1997,62:1948,64:1997,
  85:2011,95:1938,96:2001,102:2012,105:1966,112:2002,129:1956,143:1969,159:1982,161:2020,164:2006,170:1910,175:1958,179:2019,187:1925,192:1900,194:1881,196:1864,
  201:2016,202:2018,203:2021,214:1984,215:1886,220:2007,224:2007,227:1928,231:2006,241:1999,247:2015,250:1996,253:2013,
  254:1859,256:1884,261:1849,270:1868,273:1837,281:1934,282:1876,285:2001,286:2005,287:1844,293:1906,295:1947,298:1850,303:1922,
  311:2002,318:2007,324:2013,335:2004,340:1984,355:1886,367:2003,369:1847,
  376:2013,384:1998,391:2013,393:2019,395:1623,399:2002,405:1852,406:2004,408:2019,409:1973,412:2011,414:1759,417:1878,423:1958,426:1991,430:1887,433:1992,436:1900,437:1955,438:1973,439:2021,440:1911,444:1949,448:2012,449:2016,451:1605,452:2016,455:1889,461:1976,462:1965,465:2016,472:1983,473:1987,478:1946,481:1978,482:2016,488:1998,490:2014,492:2020,497:1994,499:1952,
  502:1623,504:1996,506:1923,515:2013,518:2021,523:1623,525:1860,528:1871,539:1890,540:1948,542:1963,551:2003,552:1980,558:1904,559:1970,560:2008,563:2000,566:1921,568:2008,574:1996,575:1993,578:1934,583:1476,585:1951,588:2003,592:1925,595:1901,597:1899,598:2006,611:1890,614:2009,616:1623,617:2012,625:1915,627:1977,628:1975,631:1900,632:1906,633:2012,634:1913,639:1926,641:1957,642:2012,
  658:2008,659:2019,662:2023,664:2008,667:2004,680:2007,691:2012,699:2005,702:2007,705:1995,710:2005,712:1919,714:1934,723:2017,734:2005,745:2003,749:2003,752:1997,765:1843,776:2022,793:2019,795:1963,800:2018,802:1896,804:1996,
  815:1908,817:2015,818:2015,831:2001,839:2012,840:2011,851:2012,855:2016,859:2003,860:2018,865:2022,872:2017,873:2019,876:1817,877:2014,886:2012,891:1915,916:2016,918:1988,
  926:2011,930:2012,931:2021,932:1973,933:2011,936:1966,960:1982,966:1903,967:2018,968:2005,969:2005,972:1904,987:2006,990:2014,1000:2014,
};
// No fabricated exact year where composition, serial, translation and edition diverge.
export const uncertainYears = [28,41,44,47,60,74,216,415,527,590,596,618,643,733,863,983];
export const formCorrections = {
  16:'essaybundel',17:'non-fictieboek',19:'essay',28:'non-fictieboek',
  395:'toneelstuk',440:'kort verhaal',502:'toneelstuk',527:'poëzie',
  538:'brieven en poëzie',549:'brievenbundel',616:'toneelstuk',625:'kort verhaal',643:'verzameld werk',
};
export const yearNotes = {
  129:'1956 Jiddische oorspronkelijke versie; Franse La Nuit 1958. Niet het ontstaan in 1955.',
  194:'1881 start tijdschriftpublicatie; eerste boekuitgave 1883.',
  209:'Verschenen eind 1899 met 1900 op titelblad; 1899 behouden.',
  254:'1859 publicatie, geen generiek 1800.',
  395:'Eerste gedrukte tekst 1623, niet de datering van compositie/opvoering.',
  502:'Eerste druk 1623, niet de opvoering rond 1599.',
  523:'Eerste gedrukte publicatie 1623; ontstaan/opvoering rond 1606 is een ander gegeven.',
  583:'1476 eerste gedrukte editie; ontstaan in de veertiende eeuw apart houden.',
  589:'1472 eerste druk behouden; 1321 is voltooiing, geen gedrukte editie.',
  602:'1488 eerste Griekse druk; antieke ontstaansperiode niet als exact publicatiejaar invoeren.',
  616:'Eerste druk in First Folio 1623; 1611 betreft opvoering.',
  876:'Uitgegeven december 1817; titelblad vermeldt 1818.',
  960:'1982 start seriële publicatie; verzamelde editie 1988.',
};
export const hold = {
  41:'Generieke kunstenaarsnaam als titel én auteur; exact werk/uitgave niet betrouwbaar vastgesteld.',
  44:'Citatencompilatie: samensteller/auteursrol en oorspronkelijke editie eerst vaststellen.',
  47:'Generieke kunstenaarsnaam als titel én auteur; exact kunstboek niet vastgesteld.',
  74:'Laws, etc is een generieke recordverzameling, geen geïdentificeerd individueel boek.',
  167:'Overkoepelend Lord of the Rings-record kan overlappen met aanwezige deelwerken; geen extra selectie/import tot scope is vastgesteld.',
  408:'Breasts and Eggs kan de novelle (2008) of de uitgebreide roman (2019) betekenen; huidige identiteit is onvoldoende eenduidig.',
  618:'The trophy wife / Ashley: auteursidentiteit en werkafbakening onvoldoende zeker.',
  643:'Verzamelde Shakespeare-werken overlappen met geselecteerde toneelstukken; geen individueel Work importeren.',
  863:'Doorlopende webroman/edities en oorspronkelijke publicatie onvoldoende afgebakend.',
  983:'Generieke studieboektitel; editie, medeauteurs en oorspronkelijke Work-identiteit moeten eerst vaststaan.',
};
export const extraGenres = {
  82:['literary'],98:['historical'],108:['fantasy'],126:['historical'],143:['literary'],150:['fantasy'],193:['historical'],197:['literary'],259:['horror'],304:['historical'],306:['sf'],321:['sf'],322:['sf'],328:['sf'],336:['mystery'],349:['literary'],354:['sf'],362:['horror'],474:['fantasy'],514:['mystery'],529:['fantasy'],545:['fantasy'],547:['biography'],600:['historical'],609:['fantasy'],637:['historical'],656:['fantasy'],679:['thriller'],708:['thriller'],780:['historical'],822:['fantasy'],832:['fantasy'],837:['fantasy'],849:['fantasy'],866:['sf'],874:['historical','fantasy'],892:['romance'],894:['romance'],899:['fantasy'],902:['sf'],922:['fantasy'],932:['historical'],937:['sf'],960:['thriller'],969:['science'],975:['science'],991:['society'],998:['psychology'],
};
export const sources = {
  111:['https://www.lezenvoordelijst.nl/docenten-15-18/niveau-4/en-ik-herinner-me-titus-broederland/','Fantasiewereld en queeste rond een dreigende catastrofe; fantasy met literaire invalshoek behouden.'],
  125:['https://www.bibliotheek.nl/catalogus/titel.400607050.html/ivanov/','Roman over journalist en wetenschappelijk onderzoek; wetenschap als onderwerp maakt dit geen sciencefiction.'],
  514:['https://www.bibliotheek.nl/catalogus/titel.410962694.html/de-schaduw-van-de-wind/','Vertaling van La sombra del viento, oorspronkelijke Spaanse publicatie 2001; bestaand Work 1936 behouden.'],
  105:['https://www.dbnl.org/titels/titel.php?id=drag001zeve01','Eerste druk 1966.'],
  323:['https://www.bloomsbury.com/uk/harry-potter-and-the-philosophers-stone-9781408865279/','Toverwereld en jeugd-fantasy, geen primaire horror.'],
  340:['https://stephenking.com/works/limited/eyes-of-the-dragon.html','Beperkte eerste uitgave 1984.'],
  343:['https://www.harperreach.com/products/the-hobbit-j-r-r-tolkien-9780261103344/','Fantasy-avontuur.'],
  363:['https://www.tokillamockingbird.com/the-book','Roman over racisme en recht; literaire fictie.'],
  395:['https://www.folger.edu/explore/shakespeare-in-print/first-folio/','Voor het eerst gedrukt in First Folio 1623.'],
  502:['https://www.folger.edu/explore/shakespeares-works/julius-caesar/','Eerste publicatie 1623.'],
  523:['https://www.folger.edu/explore/shakespeares-works/macbeth/an-introduction-to-this-text/','Eerste gedrukte publicatie 1623.'],
  539:['https://www.dbnl.org/tekst/bel_002bloe02_01/bel_002bloe02_01_0009.php','Noodlot 1890.'],
  558:['https://www.dbnl.org/tekst/bel_002bloe02_01/bel_002bloe02_01_0009.php','Pijpelijntjes 1904.'],
  616:['https://www.folger.edu/explore/shakespeare-in-print/first-folio/','Eerste gedrukte publicatie 1623.'],
  934:['https://www.penguinrandomhouseretail.com/book/?isbn=9780142437247','Avonturenroman en maatschappelijk commentaar; geen sciencefiction.'],
  998:['https://www.penguin.co.uk/books/454841/why-has-nobody-told-me-this-before-by-smith-dr-julie/9780241529713','Praktische mentale gezondheid en zelfhulp.'],
  1000:['https://www.penguinrandomhouse.com/books/234730/zero-to-one-by-peter-thiel-with-blake-masters/9780804139304/','Ondernemerschap en startups; gepubliceerd 2014.'],
};
