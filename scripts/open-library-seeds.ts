import type { BookMatchSeed } from './open-library-matching.ts';
import { EXPANDED_SEED_BOOKS } from './open-library-seeds-expanded.ts';

export { EXPANDED_SEED_BOOKS } from './open-library-seeds-expanded.ts';

export const SEED_CATEGORIES = [
  'fantasy-science-fiction',
  'classics',
  'thriller-crime',
  'romance',
  'non-fiction',
  'young-adult-children',
  'contemporary-general-fiction',
] as const;

export type SeedCategory = (typeof SEED_CATEGORIES)[number];

export type SeedBook = BookMatchSeed & {
  author: string;
  category: SeedCategory;
};

export const ORIGINAL_SEED_BOOKS: readonly SeedBook[] = [
  // Fantasy and science fiction (25)
  { title: 'The Hobbit', expectedOpenLibraryWorkId: 'OL27482W', author: 'J. R. R. Tolkien', firstPublishYear: 1937, category: 'fantasy-science-fiction' },
  { title: 'The Lord of the Rings', expectedOpenLibraryWorkId: 'OL27448W', author: 'J. R. R. Tolkien', firstPublishYear: 1954, category: 'fantasy-science-fiction' },
  { title: 'Dune', expectedOpenLibraryWorkId: 'OL893414W', author: 'Frank Herbert', firstPublishYear: 1965, category: 'fantasy-science-fiction' },
  { title: "The Handmaid's Tale", expectedOpenLibraryWorkId: 'OL675783W', author: 'Margaret Atwood', firstPublishYear: 1985, category: 'fantasy-science-fiction' },
  { title: 'Frankenstein', alternateTitles: ['Frankenstein; or, The Modern Prometheus'], expectedOpenLibraryWorkId: 'OL450063W', author: 'Mary Shelley', firstPublishYear: 1818, category: 'fantasy-science-fiction' },
  { title: 'Brave New World', expectedOpenLibraryWorkId: 'OL64365W', author: 'Aldous Huxley', firstPublishYear: 1932, category: 'fantasy-science-fiction' },
  { title: 'Fahrenheit 451', expectedOpenLibraryWorkId: 'OL103123W', author: 'Ray Bradbury', firstPublishYear: 1953, category: 'fantasy-science-fiction' },
  { title: 'The Martian', expectedOpenLibraryWorkId: 'OL17091839W', author: 'Andy Weir', firstPublishYear: 2011, category: 'fantasy-science-fiction' },
  { title: 'Project Hail Mary', expectedOpenLibraryWorkId: 'OL21745884W', author: 'Andy Weir', firstPublishYear: 2021, category: 'fantasy-science-fiction' },
  { title: 'Foundation', expectedOpenLibraryWorkId: 'OL46125W', author: 'Isaac Asimov', firstPublishYear: 1951, category: 'fantasy-science-fiction' },
  { title: 'Neuromancer', expectedOpenLibraryWorkId: 'OL27258W', author: 'William Gibson', firstPublishYear: 1984, category: 'fantasy-science-fiction' },
  { title: 'Snow Crash', expectedOpenLibraryWorkId: 'OL38501W', author: 'Neal Stephenson', firstPublishYear: 1992, category: 'fantasy-science-fiction' },
  { title: 'The Left Hand of Darkness', expectedOpenLibraryWorkId: 'OL59800W', author: 'Ursula K. Le Guin', firstPublishYear: 1969, category: 'fantasy-science-fiction' },
  { title: 'A Wizard of Earthsea', expectedOpenLibraryWorkId: 'OL59798W', author: 'Ursula K. Le Guin', firstPublishYear: 1968, category: 'fantasy-science-fiction' },
  { title: 'The Name of the Wind', expectedOpenLibraryWorkId: 'OL8479867W', author: 'Patrick Rothfuss', firstPublishYear: 2007, category: 'fantasy-science-fiction' },
  { title: 'The Way of Kings', expectedOpenLibraryWorkId: 'OL15358691W', author: 'Brandon Sanderson', firstPublishYear: 2010, category: 'fantasy-science-fiction' },
  { title: 'A Game of Thrones', expectedOpenLibraryWorkId: 'OL257943W', author: 'George R. R. Martin', firstPublishYear: 1996, category: 'fantasy-science-fiction' },
  { title: 'The Lion, the Witch and the Wardrobe', expectedOpenLibraryWorkId: 'OL71037W', author: 'C. S. Lewis', firstPublishYear: 1950, category: 'fantasy-science-fiction' },
  { title: 'Good Omens', expectedOpenLibraryWorkId: 'OL453936W', author: 'Terry Pratchett', firstPublishYear: 1990, category: 'fantasy-science-fiction' },
  { title: 'American Gods', expectedOpenLibraryWorkId: 'OL679360W', author: 'Neil Gaiman', firstPublishYear: 2001, category: 'fantasy-science-fiction' },
  { title: 'The Colour of Magic', expectedOpenLibraryWorkId: 'OL453657W', author: 'Terry Pratchett', firstPublishYear: 1983, category: 'fantasy-science-fiction' },
  { title: 'The Fifth Season', expectedOpenLibraryWorkId: 'OL17363125W', author: 'N. K. Jemisin', firstPublishYear: 2015, category: 'fantasy-science-fiction' },
  { title: 'The Three-Body Problem', alternateTitles: ['三体', '三体 (sān tǐ)', 'Three-Body Problem', 'Three Body Problem', 'San Ti'], preferredDisplayTitle: 'The Three-Body Problem', expectedOpenLibraryWorkId: 'OL17267881W', author: 'Cixin Liu', firstPublishYear: 2006, category: 'fantasy-science-fiction' },
  { title: 'Do Androids Dream of Electric Sheep?', expectedOpenLibraryWorkId: 'OL2172356W', author: 'Philip K. Dick', firstPublishYear: 1968, category: 'fantasy-science-fiction' },
  { title: "The Hitchhiker's Guide to the Galaxy", expectedOpenLibraryWorkId: 'OL2163649W', author: 'Douglas Adams', firstPublishYear: 1979, category: 'fantasy-science-fiction' },

  // Classics (20)
  { title: '1984', alternateTitles: ['Nineteen Eighty-Four'], preferredDisplayTitle: '1984', expectedOpenLibraryWorkId: 'OL1168083W', author: 'George Orwell', firstPublishYear: 1949, category: 'classics' },
  { title: 'Pride and Prejudice', expectedOpenLibraryWorkId: 'OL66554W', author: 'Jane Austen', firstPublishYear: 1813, category: 'classics' },
  { title: 'To Kill a Mockingbird', expectedOpenLibraryWorkId: 'OL3140822W', author: 'Harper Lee', firstPublishYear: 1960, category: 'classics' },
  { title: 'The Great Gatsby', expectedOpenLibraryWorkId: 'OL468431W', author: 'F. Scott Fitzgerald', firstPublishYear: 1925, category: 'classics' },
  { title: 'The Alchemist', alternateTitles: ['O Alquimista'], preferredDisplayTitle: 'The Alchemist', expectedOpenLibraryWorkId: 'OL796465W', author: 'Paulo Coelho', firstPublishYear: 1988, category: 'classics' },
  { title: 'Jane Eyre', expectedOpenLibraryWorkId: 'OL1095427W', author: 'Charlotte Brontë', firstPublishYear: 1847, category: 'classics' },
  { title: 'Wuthering Heights', expectedOpenLibraryWorkId: 'OL21177W', author: 'Emily Brontë', firstPublishYear: 1847, category: 'classics' },
  { title: 'Moby-Dick', alternateTitles: ['Moby Dick', 'Moby-Dick; or, The Whale'], preferredDisplayTitle: 'Moby-Dick', expectedOpenLibraryWorkId: 'OL102749W', author: 'Herman Melville', firstPublishYear: 1851, category: 'classics' },
  { title: 'The Catcher in the Rye', expectedOpenLibraryWorkId: 'OL3335245W', author: 'J. D. Salinger', firstPublishYear: 1951, category: 'classics' },
  { title: 'The Grapes of Wrath', expectedOpenLibraryWorkId: 'OL23205W', author: 'John Steinbeck', firstPublishYear: 1939, category: 'classics' },
  { title: 'Of Mice and Men', expectedOpenLibraryWorkId: 'OL23204W', author: 'John Steinbeck', firstPublishYear: 1937, category: 'classics' },
  { title: 'The Picture of Dorian Gray', expectedOpenLibraryWorkId: 'OL8193416W', author: 'Oscar Wilde', firstPublishYear: 1890, category: 'classics' },
  { title: 'Crime and Punishment', alternateTitles: ['Prestuplenie i nakazanie', 'Преступление и наказание'], preferredDisplayTitle: 'Crime and Punishment', expectedOpenLibraryWorkId: 'OL166894W', author: 'Fyodor Dostoevsky', firstPublishYear: 1866, category: 'classics' },
  { title: 'War and Peace', alternateTitles: ['Voina i mir', 'Война и мир'], preferredDisplayTitle: 'War and Peace', author: 'Leo Tolstoy', firstPublishYear: 1869, category: 'classics' },
  { title: 'Anna Karenina', expectedOpenLibraryWorkId: 'OL267096W', author: 'Leo Tolstoy', firstPublishYear: 1878, category: 'classics' },
  { title: 'One Hundred Years of Solitude', alternateTitles: ['Cien años de soledad'], preferredDisplayTitle: 'One Hundred Years of Solitude', expectedOpenLibraryWorkId: 'OL274505W', author: 'Gabriel García Márquez', firstPublishYear: 1967, category: 'classics' },
  { title: 'The Stranger', alternateTitles: ["L'Étranger", 'The Outsider'], preferredDisplayTitle: 'The Stranger', expectedOpenLibraryWorkId: 'OL1230613W', author: 'Albert Camus', firstPublishYear: 1942, category: 'classics' },
  { title: 'The Old Man and the Sea', expectedOpenLibraryWorkId: 'OL63073W', author: 'Ernest Hemingway', firstPublishYear: 1952, category: 'classics' },
  { title: 'Little Women', alternateTitles: ['Little Women; or, Meg, Jo, Beth and Amy'], preferredDisplayTitle: 'Little Women', expectedOpenLibraryWorkId: 'OL29983W', author: 'Louisa May Alcott', firstPublishYear: 1868, category: 'classics' },
  { title: 'The Count of Monte Cristo', alternateTitles: ['Le Comte de Monte-Cristo'], preferredDisplayTitle: 'The Count of Monte Cristo', author: 'Alexandre Dumas', firstPublishYear: 1844, category: 'classics' },

  // Thriller and crime (15)
  { title: 'The Girl with the Dragon Tattoo', alternateTitles: ['Män som hatar kvinnor', 'Men Who Hate Women'], preferredDisplayTitle: 'The Girl with the Dragon Tattoo', expectedOpenLibraryWorkId: 'OL5784622W', author: 'Stieg Larsson', firstPublishYear: 2005, category: 'thriller-crime' },
  { title: 'Gone Girl', expectedOpenLibraryWorkId: 'OL16239762W', author: 'Gillian Flynn', firstPublishYear: 2012, category: 'thriller-crime' },
  { title: 'The Da Vinci Code', expectedOpenLibraryWorkId: 'OL76837W', author: 'Dan Brown', firstPublishYear: 2003, category: 'thriller-crime' },
  { title: 'The Silence of the Lambs', expectedOpenLibraryWorkId: 'OL23481W', author: 'Thomas Harris', firstPublishYear: 1988, category: 'thriller-crime' },
  { title: 'The Talented Mr. Ripley', expectedOpenLibraryWorkId: 'OL59434W', author: 'Patricia Highsmith', firstPublishYear: 1955, category: 'thriller-crime' },
  { title: 'And Then There Were None', alternateTitles: ['Ten Little Indians'], preferredDisplayTitle: 'And Then There Were None', expectedOpenLibraryWorkId: 'OL471565W', author: 'Agatha Christie', firstPublishYear: 1939, category: 'thriller-crime' },
  { title: 'Murder on the Orient Express', expectedOpenLibraryWorkId: 'OL471576W', author: 'Agatha Christie', firstPublishYear: 1934, category: 'thriller-crime' },
  { title: 'The Big Sleep', expectedOpenLibraryWorkId: 'OL15400582W', author: 'Raymond Chandler', firstPublishYear: 1939, category: 'thriller-crime' },
  { title: 'The Maltese Falcon', expectedOpenLibraryWorkId: 'OL47266W', author: 'Dashiell Hammett', firstPublishYear: 1930, category: 'thriller-crime' },
  { title: 'In Cold Blood', expectedOpenLibraryWorkId: 'OL1992198W', author: 'Truman Capote', firstPublishYear: 1966, category: 'thriller-crime' },
  { title: 'The Shining', expectedOpenLibraryWorkId: 'OL81633W', author: 'Stephen King', firstPublishYear: 1977, category: 'thriller-crime' },
  { title: 'Misery', expectedOpenLibraryWorkId: 'OL81634W', author: 'Stephen King', firstPublishYear: 1987, category: 'thriller-crime' },
  { title: 'The Bourne Identity', expectedOpenLibraryWorkId: 'OL2664916W', author: 'Robert Ludlum', firstPublishYear: 1980, category: 'thriller-crime' },
  { title: 'The Spy Who Came in from the Cold', preferredDisplayTitle: 'The Spy Who Came in from the Cold', expectedOpenLibraryWorkId: 'OL15723140W', author: 'John le Carré', firstPublishYear: 1963, category: 'thriller-crime' },
  { title: 'The Name of the Rose', alternateTitles: ['Il nome della rosa'], preferredDisplayTitle: 'The Name of the Rose', expectedOpenLibraryWorkId: 'OL8996439W', author: 'Umberto Eco', firstPublishYear: 1980, category: 'thriller-crime' },

  // Romance (15)
  { title: 'The Notebook', expectedOpenLibraryWorkId: 'OL54797W', author: 'Nicholas Sparks', firstPublishYear: 1996, category: 'romance' },
  { title: 'Me Before You', expectedOpenLibraryWorkId: 'OL28353073W', author: 'Jojo Moyes', firstPublishYear: 2012, category: 'romance' },
  { title: 'Outlander', expectedOpenLibraryWorkId: 'OL3261155W', author: 'Diana Gabaldon', firstPublishYear: 1991, category: 'romance' },
  { title: "The Time Traveler's Wife", expectedOpenLibraryWorkId: 'OL4720160W', author: 'Audrey Niffenegger', firstPublishYear: 2003, category: 'romance' },
  { title: 'The Fault in Our Stars', expectedOpenLibraryWorkId: 'OL16444438W', author: 'John Green', firstPublishYear: 2012, category: 'romance' },
  { title: 'Love in the Time of Cholera', alternateTitles: ['El amor en los tiempos del cólera'], preferredDisplayTitle: 'Love in the Time of Cholera', expectedOpenLibraryWorkId: 'OL274518W', author: 'Gabriel García Márquez', firstPublishYear: 1985, category: 'romance' },
  { title: 'The Bridges of Madison County', expectedOpenLibraryWorkId: 'OL2934591W', author: 'Robert James Waller', firstPublishYear: 1992, category: 'romance' },
  { title: 'A Room with a View', expectedOpenLibraryWorkId: 'OL88813W', author: 'E. M. Forster', firstPublishYear: 1908, category: 'romance' },
  { title: 'Persuasion', expectedOpenLibraryWorkId: 'OL66544W', author: 'Jane Austen', firstPublishYear: 1817, category: 'romance' },
  { title: 'Sense and Sensibility', expectedOpenLibraryWorkId: 'OL66562W', author: 'Jane Austen', firstPublishYear: 1811, category: 'romance' },
  { title: 'North and South', expectedOpenLibraryWorkId: 'OL1103203W', author: 'Elizabeth Gaskell', firstPublishYear: 1854, category: 'romance' },
  { title: 'The Princess Bride', expectedOpenLibraryWorkId: 'OL486967W', author: 'William Goldman', firstPublishYear: 1973, category: 'romance' },
  { title: 'Call Me by Your Name', expectedOpenLibraryWorkId: 'OL8034526W', author: 'André Aciman', firstPublishYear: 2007, category: 'romance' },
  { title: 'The Rosie Project', expectedOpenLibraryWorkId: 'OL16813583W', author: 'Graeme Simsion', firstPublishYear: 2013, category: 'romance' },
  { title: 'The Kiss Quotient', expectedOpenLibraryWorkId: 'OL19744698W', author: 'Helen Hoang', firstPublishYear: 2018, category: 'romance' },

  // Non-fiction (15)
  { title: 'Sapiens', alternateTitles: ['Sapiens: A Brief History of Humankind'], preferredDisplayTitle: 'Sapiens', expectedOpenLibraryWorkId: 'OL17075811W', author: 'Yuval Noah Harari', firstPublishYear: 2011, category: 'non-fiction' },
  { title: 'The Diary of a Young Girl', alternateTitles: ['Het Achterhuis', 'Anne Frank: The Diary of a Young Girl'], preferredDisplayTitle: 'The Diary of a Young Girl', expectedOpenLibraryWorkId: 'OL266178W', author: 'Anne Frank', firstPublishYear: 1947, category: 'non-fiction' },
  { title: 'The Immortal Life of Henrietta Lacks', expectedOpenLibraryWorkId: 'OL13850788W', author: 'Rebecca Skloot', firstPublishYear: 2010, category: 'non-fiction' },
  { title: 'Thinking, Fast and Slow', preferredDisplayTitle: 'Thinking, Fast and Slow', expectedOpenLibraryWorkId: 'OL15992072W', author: 'Daniel Kahneman', firstPublishYear: 2011, category: 'non-fiction' },
  { title: 'Educated', expectedOpenLibraryWorkId: 'OL18139176W', author: 'Tara Westover', firstPublishYear: 2018, category: 'non-fiction' },
  { title: 'Becoming', expectedOpenLibraryWorkId: 'OL17930367W', author: 'Michelle Obama', firstPublishYear: 2018, category: 'non-fiction' },
  { title: 'Long Walk to Freedom', expectedOpenLibraryWorkId: 'OL1783377W', author: 'Nelson Mandela', firstPublishYear: 1994, category: 'non-fiction' },
  { title: 'Into the Wild', expectedOpenLibraryWorkId: 'OL1974546W', author: 'Jon Krakauer', firstPublishYear: 1996, category: 'non-fiction' },
  { title: 'A Brief History of Time', expectedOpenLibraryWorkId: 'OL1892617W', author: 'Stephen Hawking', firstPublishYear: 1988, category: 'non-fiction' },
  { title: 'Silent Spring', expectedOpenLibraryWorkId: 'OL1884862W', author: 'Rachel Carson', firstPublishYear: 1962, category: 'non-fiction' },
  { title: 'The Selfish Gene', expectedOpenLibraryWorkId: 'OL1966488W', author: 'Richard Dawkins', firstPublishYear: 1976, category: 'non-fiction' },
  { title: 'Guns, Germs, and Steel', alternateTitles: ['Guns, Germs and Steel'], expectedOpenLibraryWorkId: 'OL276558W', author: 'Jared Diamond', firstPublishYear: 1997, category: 'non-fiction' },
  { title: "Man's Search for Meaning", alternateTitles: ['From Death-Camp to Existentialism'], preferredDisplayTitle: "Man's Search for Meaning", expectedOpenLibraryWorkId: 'OL1268413W', author: 'Viktor E. Frankl', firstPublishYear: 1946, category: 'non-fiction' },
  { title: 'The Glass Castle', expectedOpenLibraryWorkId: 'OL46760W', author: 'Jeannette Walls', firstPublishYear: 2005, category: 'non-fiction' },
  { title: "The Omnivore's Dilemma", preferredDisplayTitle: "The Omnivore's Dilemma", expectedOpenLibraryWorkId: 'OL3296483W', author: 'Michael Pollan', firstPublishYear: 2006, category: 'non-fiction' },

  // Young adult and children's classics (10)
  { title: 'The Book Thief', expectedOpenLibraryWorkId: 'OL5819456W', author: 'Markus Zusak', firstPublishYear: 2005, category: 'young-adult-children' },
  { title: "Harry Potter and the Philosopher's Stone", alternateTitles: ["Harry Potter and the Sorcerer's Stone"], preferredDisplayTitle: "Harry Potter and the Philosopher's Stone", expectedOpenLibraryWorkId: 'OL82563W', author: 'J. K. Rowling', firstPublishYear: 1997, category: 'young-adult-children' },
  { title: 'The Little Prince', alternateTitles: ['Le Petit Prince'], preferredDisplayTitle: 'The Little Prince', expectedOpenLibraryWorkId: 'OL10263W', author: 'Antoine de Saint-Exupéry', firstPublishYear: 1943, category: 'young-adult-children' },
  { title: "Alice's Adventures in Wonderland", alternateTitles: ['Alice in Wonderland'], expectedOpenLibraryWorkId: 'OL138052W', author: 'Lewis Carroll', firstPublishYear: 1865, category: 'young-adult-children' },
  { title: 'The Secret Garden', expectedOpenLibraryWorkId: 'OL69612W', author: 'Frances Hodgson Burnett', firstPublishYear: 1911, category: 'young-adult-children' },
  { title: 'Anne of Green Gables', expectedOpenLibraryWorkId: 'OL77746W', author: 'L. M. Montgomery', firstPublishYear: 1908, category: 'young-adult-children' },
  { title: 'The Wind in the Willows', expectedOpenLibraryWorkId: 'OL28570037W', author: 'Kenneth Grahame', firstPublishYear: 1908, category: 'young-adult-children' },
  { title: "Charlotte's Web", expectedOpenLibraryWorkId: 'OL483391W', author: 'E. B. White', firstPublishYear: 1952, category: 'young-adult-children' },
  { title: 'The Giver', expectedOpenLibraryWorkId: 'OL1846076W', author: 'Lois Lowry', firstPublishYear: 1993, category: 'young-adult-children' },
  { title: 'A Wrinkle in Time', expectedOpenLibraryWorkId: 'OL41495W', author: "Madeleine L'Engle", firstPublishYear: 1962, category: 'young-adult-children' },
];

export const ADDITIONAL_SEED_BOOKS: readonly SeedBook[] = [
  { title: 'The Hunger Games', expectedOpenLibraryWorkId: 'OL5735363W', author: 'Suzanne Collins', firstPublishYear: 2008, category: 'young-adult-children' },
  { title: 'The Road', expectedOpenLibraryWorkId: 'OL40873W', author: 'Cormac McCarthy', firstPublishYear: 2006, category: 'fantasy-science-fiction' },
  { title: 'The Seven Husbands of Evelyn Hugo', expectedOpenLibraryWorkId: 'OL18203673W', author: 'Taylor Jenkins Reid', firstPublishYear: 2017, category: 'romance' },
  { title: 'Normal People', expectedOpenLibraryWorkId: 'OL20150260W', author: 'Sally Rooney', firstPublishYear: 2018, category: 'romance' },
  { title: 'It', expectedOpenLibraryWorkId: 'OL81613W', author: 'Stephen King', firstPublishYear: 1986, category: 'thriller-crime' },
  { title: 'Atomic Habits', alternateTitles: ['Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones'], preferredDisplayTitle: 'Atomic Habits', expectedOpenLibraryWorkId: 'OL17930368W', author: 'James Clear', firstPublishYear: 2018, category: 'non-fiction' },
  { title: 'The Subtle Art of Not Giving a F*ck', alternateTitles: ['The Subtle Art of Not Giving a Fuck', 'The Subtle Art of Not Giving a F**k'], preferredDisplayTitle: 'The Subtle Art of Not Giving a F*ck', expectedOpenLibraryWorkId: 'OL17590212W', author: 'Mark Manson', firstPublishYear: 2016, category: 'non-fiction' },
  { title: 'Born a Crime', alternateTitles: ['Born a Crime: Stories from a South African Childhood'], preferredDisplayTitle: 'Born a Crime', expectedOpenLibraryWorkId: 'OL17824318W', author: 'Trevor Noah', firstPublishYear: 2016, category: 'non-fiction' },
  { title: 'Matilda', expectedOpenLibraryWorkId: 'OL45846W', author: 'Roald Dahl', firstPublishYear: 1988, category: 'young-adult-children' },
  { title: 'Charlie and the Chocolate Factory', expectedOpenLibraryWorkId: 'OL45790W', author: 'Roald Dahl', firstPublishYear: 1964, category: 'young-adult-children' },
  { title: 'The Very Hungry Caterpillar', expectedOpenLibraryWorkId: 'OL52987W', author: 'Eric Carle', firstPublishYear: 1969, category: 'young-adult-children' },
  { title: 'The Midnight Library', expectedOpenLibraryWorkId: 'OL20965973W', author: 'Matt Haig', firstPublishYear: 2020, category: 'fantasy-science-fiction' },
  { title: 'Where the Crawdads Sing', expectedOpenLibraryWorkId: 'OL18766691W', author: 'Delia Owens', firstPublishYear: 2018, category: 'thriller-crime' },
  { title: 'The Song of Achilles', expectedOpenLibraryWorkId: 'OL16509148W', author: 'Madeline Miller', firstPublishYear: 2011, category: 'romance' },
  { title: 'Circe', expectedOpenLibraryWorkId: 'OL18012166W', author: 'Madeline Miller', firstPublishYear: 2018, category: 'fantasy-science-fiction' },
];

export const LEGACY_SEED_BOOKS: readonly SeedBook[] = [
  ...ORIGINAL_SEED_BOOKS,
  ...ADDITIONAL_SEED_BOOKS,
];

export const SEED_BOOKS: readonly SeedBook[] = [
  ...LEGACY_SEED_BOOKS,
  ...EXPANDED_SEED_BOOKS,
];

export const MANUAL_VERIFICATION_TITLES = [
  'The Lord of the Rings',
  'The Three-Body Problem',
  'Crime and Punishment',
  'War and Peace',
  'One Hundred Years of Solitude',
  'The Stranger',
  'The Girl with the Dragon Tattoo',
  'And Then There Were None',
  'The Diary of a Young Girl',
  "Man's Search for Meaning",
  'The Little Prince',
  'コーヒーが冷めないうちに',
  'Don Quijote de la Mancha',
  'La Divina Commedia',
  'Доктор Живаго',
  'The Adventures of Sherlock Holmes [12 stories]',
  'The Alchemist, 1612',
  'Pippi Långstrump',
  'Arsène Lupin, gentleman-cambrioleur',
  '嫌われる勇気',
  'Cadáver exquisito',
  'Der Proceß',
  'Мы',
  'Ἰλιάς',
  'Ὀδύσσεια',
  'Смерть Ивана Ильича',
  'Записки изъ подполья',
  'Идиот',
  '夏物語',
  'キッチン',
  'Cantik Itu Luka',
  "Le Ventre de l'Atlantique",
] as const;
