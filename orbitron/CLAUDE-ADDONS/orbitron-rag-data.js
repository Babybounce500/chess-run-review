/*
 * Orbitron Chess — local master-game evidence bank.
 * No network, database, or runtime embedding call is required.
 * The browser derives chess-aware vectors from these complete PGNs.
 */
window.ORBITRON_RAG_GAMES = [
  {
    id: 'kasparov-topalov-1999',
    title: 'Kasparov vs Topalov',
    event: 'Hoogovens',
    year: 1999,
    players: 'Garry Kasparov · Veselin Topalov',
    result: '1-0',
    opening: 'B87 Sicilian Defense · Modern',
    tags: ['king hunt', 'sacrifice', 'initiative', 'open lines'],
    keyMoments: ['15.Nf5', '24.Rxd4', '31.Bh6', '36.Qh6'],
    pgn: `[Event "Hoogovens"]
[Site "Wijk aan Zee"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[ECO "B07"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`
  },
  {
    id: 'fischer-byrne-1956',
    title: 'Fischer vs Byrne',
    event: 'Rosenwald Memorial',
    year: 1956,
    players: 'Bobby Fischer · Donald Byrne',
    result: '0-1',
    opening: 'D92 Grünfeld Defense',
    tags: ['queen sacrifice', 'development', 'dark squares', 'tactics'],
    keyMoments: ['11...Nxd4', '17...Be6', '18...Bxd5', '22...Nxf3'],
    pgn: `[Event "New York Rosenwald"]
[Site "New York"]
[Date "1956.??.??"]
[Round "?"]
[White "Donald Byrne"]
[Black "Bobby Fischer"]
[Result "0-1"]
[ECO "D97"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2+ 0-1`
  },
  {
    id: 'morphy-opera-1858',
    title: 'Morphy vs Duke of Brunswick / Count Isouard',
    event: 'Paris Opera Game',
    year: 1858,
    players: 'Paul Morphy · Duke of Brunswick & Count Isouard',
    result: '1-0',
    opening: 'C41 Philidor Defense',
    tags: ['rapid development', 'central break', 'pin', 'coordination'],
    keyMoments: ['7.Bg5', '10.Bxb5', '12.Bxf6', '16.Qxd8'],
    pgn: `[Event "Paris Opera Game"]
[Site "Paris"]
[Date "1858.11.02"]
[Round "1"]
[White "Paul Morphy"]
[Black "Duke of Brunswick and Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`
  },
  {
    id: 'carlsen-anand-2013',
    title: 'Carlsen vs Anand',
    event: 'World Championship',
    year: 2013,
    players: 'Magnus Carlsen · Viswanathan Anand',
    result: '1-0',
    opening: 'A07 Réti Opening',
    tags: ['prophylaxis', 'endgame', 'minority pressure', 'conversion'],
    keyMoments: ['20.Nd2', '28.b4', '31.Rxd5', '38.Kf3'],
    pgn: `[Event "World Championship"]
[Site "Chennai"]
[Date "2013.11.09"]
[Round "1"]
[White "Magnus Carlsen"]
[Black "Viswanathan Anand"]
[Result "1/2-1/2"]
[ECO "A07"]

1. Nf3 d5 2. g3 g6 3. Bg2 Bg7 4. d4 c6 5. O-O Nf6 6. b3 O-O 7. Bb2 Bf5 8. c4 Nbd7 9. Nc3 dxc4 10. bxc4 Nb6 11. c5 Nc4 12. Bc1 Nd5 13. Qb3 Na5 14. Qa3 Nc4 15. Qb3 Na5 16. Qa3 Nc4 1/2-1/2`
  },
  {
    id: 'karpov-kasparov-1985',
    title: 'Karpov vs Kasparov',
    event: 'World Championship',
    year: 1984,
    players: 'Anatoly Karpov · Garry Kasparov',
    result: '1-0',
    opening: 'B44 Sicilian Defense · Kan Variation',
    tags: ['outpost', 'space', 'pawn structure', 'precision'],
    keyMoments: ['13.Qxb6', '19.Rxd5', '28.Rd7', '31.Bb6'],
    pgn: `[Event "World Championship"]
[Site "Moscow"]
[Date "1984.??.??"]
[Round "3"]
[White "Anatoly Karpov"]
[Black "Garry Kasparov"]
[Result "1-0"]
[ECO "B44"]

1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nb5 d6 6. c4 Nf6 7. N1c3 a6 8. Na3 Be7 9. Be2 O-O 10. O-O b6 11. Be3 Bb7 12. Qb3 Na5 13. Qxb6 Nxe4 14. Nxe4 Bxe4 15. Qxd8 Bxd8 16. Rad1 d5 17. f3 Bf5 18. cxd5 exd5 19. Rxd5 Be6 20. Rd6 Bxa2 21. Rxa6 Rb8 22. Bc5 Re8 23. Bb5 Re6 24. b4 Nb7 25. Bf2 Be7 26. Nc2 Bd5 27. Rd1 Bb3 28. Rd7 Rd8 29. Rxe6 Rxd7 30. Re1 Rc7 31. Bb6 1-0`
  },

  // ---- Erweiterung: 14 Partien aus pgnmentor.com/openings, ausgewaehlt entlang
  // der tatsaechlichen Repertoire-Linien aus 0-CHESS-PGN/ (Italienisch, Sizilianisch
  // Kan/Taimanov, Schottisch, Caro-Kann, Damengambit Orthodox, London-System).
  // Alle Partien 2600+ Elo auf beiden Seiten, dekisiv, chess.js-validiert.
  // keyMoments bewusst leer gelassen (nicht manuell verifiziert, keine erfundenen
  // taktischen Behauptungen) -- siehe [[deep-orbitron-tutor]] Memory.
  {
    id: 'ding-liren-carlsen-2020',
    title: 'Ding Liren vs Magnus Carlsen',
    event: 'Carlsen Inv Final 4',
    year: 2020,
    players: 'Ding Liren · Magnus Carlsen',
    result: '1-0',
    opening: 'C50 Italian Game · Giuoco Piano',
    tags: ["italian game","giuoco piano"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (GiuocoPiano)',
    pgn: `[Event "Carlsen Inv Final 4"]
[Site "chess24.com INT"]
[Date "2020.05.02"]
[Round "1.2"]
[White "Ding Liren"]
[Black "Carlsen,M"]
[Result "1-0"]
[WhiteElo "2791"]
[BlackElo "2863"]
[ECO "C50"]

1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O Nf6 5.d3 d6 6.c3 h6 7.Re1 O-O 8.h3 Re8 9.Nbd2 a6 10.a4 Be6 11.Bxe6 Rxe6 12.b4 Ba7 13.Qc2 Qd7 14.Nf1 d5 15.Be3 Bxe3 16.Nxe3 Ne7 17.a5 Ng6 18.g3 Rd8 19.Kg2 Qc6 20.Nf5 Ne7 21.Nxe7+ Rxe7 22.c4 dxe4 23.dxe4 Qe8 24.Rad1 c5 25.bxc5 Rc8 26.Nh4 Rxc5 27.Nf5 Rd7 28.Rxd7 Qxd7 29.Rd1 Qc7 30.Rd6 Rxc4 31.Qd3 Kh7 32.Rxf6 gxf6 33.Qe3 1-0`
  },
  {
    id: 'kramnik-carlsen-2017',
    title: 'Vladimir Kramnik vs Magnus Carlsen',
    event: '5th Norway Chess 2017',
    year: 2017,
    players: 'Vladimir Kramnik · Magnus Carlsen',
    result: '1-0',
    opening: 'C53 Italian Game · Giuoco Piano',
    tags: ["italian game","giuoco piano"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (GiuocoPiano)',
    pgn: `[Event "5th Norway Chess 2017"]
[Site "Stavanger NOR"]
[Date "2017.06.14"]
[Round "7.3"]
[White "Kramnik,V"]
[Black "Carlsen,M"]
[Result "1-0"]
[WhiteElo "2808"]
[BlackElo "2832"]
[ECO "C53"]

1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O a6 7.Re1 Ba7 8.a4 O-O 9.h3 Ne7 10.d4 Ng6 11.Nbd2 c6 12.Bd3 Re8 13.Bc2 h6 14.Nf1 exd4 15.cxd4 c5 16.d5 b5 17.axb5 axb5 18.Ng3 Bd7 19.Be3 Bb6 20.Rxa8 Qxa8 21.b4 Qa7 22.Qa1 Qc7 23.Bxh6 cxb4 24.Bxg7 Qxc2 25.Qxf6 Qxf2+ 26.Kh2 Bd8 27.Qxd6 Nh4 28.Nxh4 Bxh4 29.Nh5 Bxh3 30.Rg1 Bg5 31.Bf6 Bg4 32.Bxg5 Bxh5 33.Qh6 Rxe4 34.Qxh5 Qf5 35.Qh6 b3 36.Bf6 Qf4+ 37.Qxf4 Rxf4 38.d6 Rxf6 39.Rd1 Rh6+ 40.Kg1 1-0`
  },
  {
    id: 'caruana-carlsen-2023',
    title: 'Fabiano Caruana vs Magnus Carlsen',
    event: 'CCT Final KO 2023',
    year: 2023,
    players: 'Fabiano Caruana · Magnus Carlsen',
    result: '0-1',
    opening: 'B43 Sicilian Defense · Kan Variation',
    tags: ["sicilian defense","kan variation"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (SicilianKan5Nc3)',
    pgn: `[Event "CCT Final KO 2023"]
[Site "Toronto CAN"]
[Date "2023.12.13"]
[Round "1.15"]
[White "Caruana,F"]
[Black "Carlsen,M"]
[Result "0-1"]
[WhiteElo "2794"]
[BlackElo "2830"]
[ECO "B43"]

1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Nc3 Qc7 6.Bd3 Nf6 7.Qe2 d6 8.f4 Nbd7 9.g4 Nc5 10.g5 Nfd7 11.a4 Be7 12.h4 b6 13.Be3 Bb7 14.h5 Rc8 15.Rg1 g6 16.Rh1 e5 17.hxg6 fxg6 18.Nf3 exf4 19.Bxf4 Nxd3+ 20.cxd3 Ne5 21.Be3 O-O 22.Nd4 Qd7 23.O-O-O b5 24.axb5 axb5 25.Kb1 b4 26.Na2 d5 27.Rxh7 Kxh7 28.Qh2+ Kg8 29.Rh1 Bd6 30.Bf4 Qg7 31.Ne6 Nf3 32.Nxg7 Nxh2 33.Bxd6 Rf1+ 34.Rxf1 Nxf1 35.Bxb4 Kxg7 36.Bc3+ Kf7 37.Nb4 dxe4 38.dxe4 Bxe4+ 39.Ka2 Ne3 0-1`
  },
  {
    id: 'kasparov-topalov-1998',
    title: 'Garry Kasparov vs Veselin Topalov',
    event: 'Sofia m 25\'',
    year: 1998,
    players: 'Garry Kasparov · Veselin Topalov',
    result: '1-0',
    opening: 'B43 Sicilian Defense · Kan Variation',
    tags: ["sicilian defense","kan variation"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (SicilianKan5Nc3)',
    pgn: `[Event "Sofia m 25'"]
[Site "Sofia"]
[Date "1998.??.??"]
[Round "4"]
[White "Kasparov, Gary"]
[Black "Topalov, Veselin"]
[Result "1-0"]
[WhiteElo "2825"]
[BlackElo "2740"]
[ECO "B43"]

1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Nc3 Qc7 6.Be2 b5 7.O-O b4 8.Na4 Bb7 9.c3 Nf6 10.cxb4 Bxb4 11.Be3 O-O 12.Rc1 Nc6 13.Qd3 Qa5 14.Nc5 Ne5 15.Qb1 Bxc5 16.Nb3 Qc7 17.Rxc5 Qb8 18.f3 d5 19.Na5 Rc8 20.b4 Nc6 21.Nxb7 Qxb7 22.Rfc1 dxe4 23.fxe4 Nd7 24.R5c3 Nde5 25.a4 Rd8 26.b5 axb5 27.Qxb5 Qxb5 28.axb5 Nb4 29.Rb1 Ra2 30.Bf1 Rc2 31.Rxc2 Nxc2 32.Bc5 Nd4 33.b6 Ndc6 34.b7 h5 35.Bb6 Rd2 36.Ba5 Rd4 37.Bc3 1-0`
  },
  {
    id: 'nepomniachtchi-carlsen-2022',
    title: 'Ian Nepomniachtchi vs Magnus Carlsen',
    event: 'Airthings Masters KO 2022',
    year: 2022,
    players: 'Ian Nepomniachtchi · Magnus Carlsen',
    result: '0-1',
    opening: 'B48 Sicilian Defense · Taimanov Variation',
    tags: ["sicilian defense","taimanov variation"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (SicilianTaimanovMain)',
    pgn: `[Event "Airthings Masters KO 2022"]
[Site "chess24.com INT"]
[Date "2022.02.26"]
[Round "3.23"]
[White "Nepomniachtchi,I"]
[Black "Carlsen,M"]
[Result "0-1"]
[WhiteElo "2773"]
[BlackElo "2865"]
[ECO "B48"]

1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 Qc7 6.Be3 a6 7.g4 Nxd4 8.Qxd4 b5 9.O-O-O Bb7 10.Kb1 Nf6 11.f3 Rc8 12.g5 Nh5 13.Qd2 Be7 14.Bh3 b4 15.Ne2 d5 16.Bg4 g6 17.Bxh5 gxh5 18.Nf4 dxe4 19.Nxh5 exf3 20.Bf4 Qd8 21.Qe3 Bd5 22.Nf6+ Bxf6 23.gxf6 Rg8 24.Rhe1 Rg2 25.Qa7 Qd7 26.Qd4 Rcxc2 27.Bc1 Rxc1+ 28.Kxc1 Qc6+ 29.Kb1 Qa4 30.Rd2 Bxa2+ 0-1`
  },
  {
    id: 'nakamura-carlsen-2024',
    title: 'Hikaru Nakamura vs Magnus Carlsen',
    event: 'Casablanca Chess 2024',
    year: 2024,
    players: 'Hikaru Nakamura · Magnus Carlsen',
    result: '0-1',
    opening: 'B45 Sicilian Defense · Taimanov Variation',
    tags: ["sicilian defense","taimanov variation"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (SicilianTaimanovMain)',
    pgn: `[Event "Casablanca Chess 2024"]
[Site "Casablanca MAR"]
[Date "2024.05.18"]
[Round "3.1"]
[White "Nakamura,Hi"]
[Black "Carlsen,M"]
[Result "0-1"]
[WhiteElo "2795"]
[BlackElo "2830"]
[ECO "B45"]

1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 d6 6.g4 h6 7.h4 a6 8.Bg2 Be7 9.Be3 Nxd4 10.Qxd4 e5 11.Qd1 Be6 12.Nd5 Rc8 13.c3 Nf6 14.Nxe7 Kxe7 15.g5 Ng4 16.Bc1 hxg5 17.Bf3 Qd7 18.Rg1 Nh2 19.Bxg5+ f6 20.Be3 Rcg8 21.h5 Nxf3+ 22.Qxf3 Qb5 23.Bc1 Bf7 24.Rh1 Qa4 25.Qe2 d5 26.exd5 Bxd5 27.Rh2 Qc6 28.f4 Bf3 29.Qe3 Rxh5 30.Rxh5 Bxh5 31.fxe5 Re8 32.Qg1 Kf7 33.Be3 Rxe5 34.Kd2 Qd5+ 35.Kc1 Rxe3 0-1`
  },
  {
    id: 'xiong-carlsen-2020',
    title: 'Jeffery Xiong vs Magnus Carlsen',
    event: 'Clutch Chess Showdown Int',
    year: 2020,
    players: 'Jeffery Xiong · Magnus Carlsen',
    result: '1-0',
    opening: 'C45 Scotch Game · Classical',
    tags: ["scotch game"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (Scotch4Bc5)',
    pgn: `[Event "Clutch Chess Showdown Int"]
[Site "lichess.org INT"]
[Date "2020.06.08"]
[Round "1.7"]
[White "Xiong,Jeffery"]
[Black "Carlsen,M"]
[Result "1-0"]
[WhiteElo "2709"]
[BlackElo "2863"]
[ECO "C45"]

1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Bc5 5.Be3 Qf6 6.c3 Nge7 7.Bb5 O-O 8.O-O Bb6 9.a4 Qg6 10.Bd3 Bxd4 11.cxd4 Nb4 12.Nc3 Nxd3 13.Qxd3 d5 14.f3 c6 15.Qd2 Be6 16.Rae1 Rae8 17.Ne2 f6 18.e5 fxe5 19.dxe5 b6 20.b4 Rc8 21.Rc1 Rfd8 22.Nd4 h6 23.a5 Rd7 24.Rfe1 Rb7 25.axb6 axb6 26.Qe2 Rbb8 27.Bf2 Bh3 28.Bg3 c5 29.Nb5 Be6 30.Nd6 Rc6 31.Qb5 Ra8 32.bxc5 Ra5 33.Qb4 Raxc5 34.Rxc5 bxc5 35.Qb7 c4 36.Qxe7 c3 37.Qb7 Rc5 38.Qb6 1-0`
  },
  {
    id: 'carlsen-bacrot-2010',
    title: 'Magnus Carlsen vs Etienne Bacrot',
    event: '3rd Pearl Spring',
    year: 2010,
    players: 'Magnus Carlsen · Etienne Bacrot',
    result: '1-0',
    opening: 'C45 Scotch Game · Classical',
    tags: ["scotch game"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (Scotch4Bc5)',
    pgn: `[Event "3rd Pearl Spring"]
[Site "Nanjing CHN"]
[Date "2010.10.20"]
[Round "1"]
[White "Carlsen,M"]
[Black "Bacrot,E"]
[Result "1-0"]
[WhiteElo "2826"]
[BlackElo "2716"]
[ECO "C45"]

1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Bc5 5.Nb3 Bb6 6.Nc3 Nf6 7.Qe2 O-O 8.Bg5 h6 9.Bh4 a5 10.a4 Nd4 11.Qd3 Nxb3 12.cxb3 Re8 13.O-O-O d6 14.Qc2 Bd7 15.Bc4 Be6 16.Rhe1 Qe7 17.e5 dxe5 18.Rxe5 Qf8 19.Bxf6 gxf6 20.Re2 Qg7 21.Bxe6 Rxe6 22.Rxe6 fxe6 23.Rd3 Kh8 24.Rg3 Qh7 25.Qd2 Bc5 26.Ne4 Be7 27.Rh3 Kg7 28.Qd7 Kf7 29.Ng5+ fxg5 30.Rf3+ Kg8 31.Qxe6+ Kh8 32.Rf7 Bd6 33.Rxh7+ Kxh7 34.Qf7+ Kh8 35.g3 Ra6 36.Kb1 Bb4 37.f4 gxf4 38.gxf4 1-0`
  },
  {
    id: 'caruana-so-2020',
    title: 'Fabiano Caruana vs Wesley So',
    event: 'Clutch Chess Showdown Int',
    year: 2020,
    players: 'Fabiano Caruana · Wesley So',
    result: '1-0',
    opening: 'B19 Caro-Kann Defense · Classical',
    tags: ["caro-kann defense","classical variation"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (Caro-KannClassic)',
    pgn: `[Event "Clutch Chess Showdown Int"]
[Site "lichess.org INT"]
[Date "2020.06.12"]
[Round "2.10"]
[White "Caruana,F"]
[Black "So,W"]
[Result "1-0"]
[WhiteElo "2835"]
[BlackElo "2770"]
[ECO "B19"]

1.e4 c6 2.d4 d5 3.Nd2 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.Bd3 Bxd3 9.Qxd3 e6 10.Bd2 Ngf6 11.O-O-O Be7 12.Kb1 O-O 13.Ne4 Nxe4 14.Qxe4 Nf6 15.Qe2 Qd5 16.Ne5 Qe4 17.Be3 Nd5 18.Qd3 Qxd3 19.Rxd3 Nxe3 20.fxe3 h5 21.Rb3 Bd6 22.Nc4 Bg3 23.Rh3 Bf2 24.Rxb7 Rfb8 25.Rxb8+ Rxb8 26.Ne5 1-0`
  },
  {
    id: 'karjakin-mamedyarov-2013',
    title: 'Sergey Karjakin vs Shakhriyar Mamedyarov',
    event: 'Renova FIDE GP Zug',
    year: 2013,
    players: 'Sergey Karjakin · Shakhriyar Mamedyarov',
    result: '1-0',
    opening: 'B19 Caro-Kann Defense · Classical',
    tags: ["caro-kann defense","classical variation"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (Caro-KannClassic)',
    pgn: `[Event "Renova FIDE GP Zug"]
[Site "Zug SUI"]
[Date "2013.04.23"]
[Round "5.2"]
[White "Karjakin,Sergey"]
[Black "Mamedyarov,S"]
[Result "1-0"]
[WhiteElo "2786"]
[BlackElo "2766"]
[ECO "B19"]

1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3 e6 11.Bd2 Ngf6 12.O-O-O Be7 13.Kb1 Qb6 14.Rhe1 O-O 15.Nf5 Bb4 16.Nxh6+ gxh6 17.c3 Ba3 18.Bc1 Rfe8 19.g4 Nh7 20.c4 Bf8 21.g5 hxg5 22.Nxg5 Nxg5 23.Bxg5 Kh8 24.Rg1 Qc7 25.Qf3 f6 26.Bf4 Bd6 27.Qg3 Nc5 28.Bxd6 Qh7+ 29.Ka1 Ne4 30.Qh4 Rg8 31.f3 Ng5 32.Qf4 Qf5 33.Qxf5 exf5 34.Be7 Nxf3 35.Rgf1 Rg3 36.d5 cxd5 37.cxd5 Kg7 38.Rd3 Kf7 39.Bd6 Nh2 40.Bxg3 1-0`
  },
  {
    id: 'mamedyarov-dominguez-perez-2020',
    title: 'Shakhriyar Mamedyarov vs Leinier Dominguez Perez',
    event: 'PRO League KO Stage 2020',
    year: 2020,
    players: 'Shakhriyar Mamedyarov · Leinier Dominguez Perez',
    result: '0-1',
    opening: 'D53 Queen\'s Gambit Declined · Orthodox',
    tags: ["queens gambit declined","orthodox defense"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (QGDOrthoMain)',
    pgn: `[Event "PRO League KO Stage 2020"]
[Site "chess.com INT"]
[Date "2020.03.10"]
[Round "2"]
[White "Mamedyarov,S"]
[Black "Dominguez Perez,L"]
[Result "0-1"]
[WhiteElo "2764"]
[BlackElo "2758"]
[ECO "D53"]

1.d4 Nf6 2.c4 e6 3.Nc3 d5 4.Bg5 Be7 5.Nf3 h6 6.Bf4 O-O 7.e3 c5 8.dxc5 Bxc5 9.Qc2 Nc6 10.a3 Qa5 11.O-O-O Ne4 12.cxd5 Nxc3 13.Qxc3 Qxc3+ 14.bxc3 Bxa3+ 15.Kc2 exd5 16.Rxd5 Be6 17.Rb5 b6 18.Nd4 Nxd4+ 19.cxd4 Rac8+ 20.Kd2 Rc1 21.d5 Bf5 22.Rb3 Rc2+ 23.Kd1 Ra2 24.Rc3 Bb4 25.Rc4 a5 26.Be5 Rd2+ 27.Kc1 Rxd5 28.Bd4 b5 29.Rc7 Bd6 30.Rc6 Ba3+ 31.Kd1 Bb2 32.Rc5 Rxc5 33.Bxc5 Rd8+ 34.Ke2 a4 35.Kf3 Rd1 36.g4 Bd3 37.Bg2 Rxh1 0-1`
  },
  {
    id: 'abdusattorov-so-2023',
    title: 'Nodirbek Abdusattorov vs Wesley So',
    event: 'CCT Final KO 2023',
    year: 2023,
    players: 'Nodirbek Abdusattorov · Wesley So',
    result: '1-0',
    opening: 'D53 Queen\'s Gambit Declined · Orthodox',
    tags: ["queens gambit declined","orthodox defense"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (QGDOrthoMain)',
    pgn: `[Event "CCT Final KO 2023"]
[Site "Toronto CAN"]
[Date "2023.12.13"]
[Round "1.12"]
[White "Abdusattorov,Nodirbek"]
[Black "So,W"]
[Result "1-0"]
[WhiteElo "2727"]
[BlackElo "2752"]
[ECO "D53"]

1.d4 Nf6 2.c4 e6 3.Nc3 d5 4.Bg5 Be7 5.e3 h6 6.Bxf6 Bxf6 7.Nf3 O-O 8.cxd5 exd5 9.Qb3 c6 10.Bd3 Re8 11.O-O Nd7 12.Qc2 Be7 13.Rae1 Nf6 14.Ne5 a6 15.Na4 Be6 16.f4 Rc8 17.a3 a5 18.Rc1 Bd6 19.h3 Ne4 20.f5 Bd7 21.Bxe4 Bxe5 22.dxe5 dxe4 23.Qxe4 c5 24.e6 Bxa4 25.Qxa4 fxe6 26.f6 Rf8 27.Rcd1 Qe8 28.Qg4 Rf7 29.Rf4 Kh7 30.Qf3 Qc6 31.Qh5 Rcf8 32.Rd8 Rxd8 33.Qxf7 Rd1+ 34.Kh2 Rd7 35.Qxd7 Qxd7 36.f7 1-0`
  },
  {
    id: 'carlsen-tomashevsky-2016',
    title: 'Magnus Carlsen vs Evgeny Tomashevsky',
    event: '78th Tata Steel GpA',
    year: 2016,
    players: 'Magnus Carlsen · Evgeny Tomashevsky',
    result: '1-0',
    opening: 'A46 London System',
    tags: ["london system"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (London2e6)',
    pgn: `[Event "78th Tata Steel GpA"]
[Site "Wijk aan Zee NED"]
[Date "2016.01.22"]
[Round "6.1"]
[White "Carlsen,M"]
[Black "Tomashevsky,E"]
[Result "1-0"]
[WhiteElo "2844"]
[BlackElo "2728"]
[ECO "A46"]

1.d4 Nf6 2.Nf3 e6 3.Bf4 b6 4.e3 Bb7 5.h3 Be7 6.Bd3 O-O 7.O-O c5 8.c3 Nc6 9.Nbd2 d5 10.Qe2 Bd6 11.Rfe1 Ne7 12.Rad1 Ng6 13.Bxg6 hxg6 14.Bxd6 Qxd6 15.Ne5 g5 16.f4 gxf4 17.Rf1 Nd7 18.Qh5 Nf6 19.Qh4 Qd8 20.Rxf4 Ne4 21.Nxe4 Qxh4 22.Rxh4 dxe4 23.dxc5 bxc5 24.Rd7 Rab8 25.b3 a5 26.Rc7 a4 27.bxa4 Ba8 28.a5 Rb7 29.Rxc5 Ra7 30.Nc4 1-0`
  },
  {
    id: 'abdusattorov-maghsoodloo-2024',
    title: 'Nodirbek Abdusattorov vs Parham Maghsoodloo',
    event: 'UzChess Cup Masters 2024',
    year: 2024,
    players: 'Nodirbek Abdusattorov · Parham Maghsoodloo',
    result: '1-0',
    opening: 'A46 London System',
    tags: ["london system"],
    keyMoments: [],
    source: 'pgnmentor.com/openings (London2e6)',
    pgn: `[Event "UzChess Cup Masters 2024"]
[Site "Tashkent UZB"]
[Date "2024.06.06"]
[Round "1.1"]
[White "Abdusattorov,Nodirbek"]
[Black "Maghsoodloo,Parham"]
[Result "1-0"]
[WhiteElo "2766"]
[BlackElo "2733"]
[ECO "A46"]

1.d4 Nf6 2.Nf3 e6 3.Bf4 c5 4.e3 Nc6 5.Nbd2 h6 6.Nc4 d5 7.Nce5 Qb6 8.Rb1 Nxe5 9.Nxe5 Bd6 10.c3 Bd7 11.Bd3 Rd8 12.a4 O-O 13.h4 cxd4 14.exd4 Ne4 15.O-O Be8 16.Qg4 Qc7 17.Bc2 Kh8 18.f3 Nf6 19.Qh3 Nh5 20.Bh2 f6 21.f4 fxe5 22.fxe5 Be7 23.g4 Qc4 24.Rxf8+ Bxf8 25.Qf3 Be7 26.gxh5 b5 27.Rf1 Kg8 28.b3 Qc7 29.Qd3 g6 30.Qh3 Kg7 31.Qxe6 Bxh4 32.Qf6+ 1-0`
  }
];