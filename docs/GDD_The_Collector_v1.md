# THE COLLECTOR — GDD v1

## 1. VISIÓN Y FILOSOFÍA

### 1.1 Concepto Elevator Pitch
**The Collector** es un juego de cartas PVE donde tú eres un coleccionista de TCGs reales (MTG, Star Wars Destiny, One Piece TCG, Marvel Champions, etc.) que adapta sus cartas favoritas para crear su propio sistema de juego solitario. Cada batalla es un enfrentamiento único contra un enemigo asimétrico en un escenario con Trama propia, donde el azar compartido del sistema de Núcleos y la gestión de recursos crean tensión táctica en cada turno.

### 1.2 Filosofía de Diseño
- **Coleccionable honesto:** Sin monetización agresiva. Todo se obtiene con moneda del juego (Créditos).
- **Meta-consciencia:** El jugador es un coleccionista que adapta cartas de múltiples universos a su propio juego PVE.
- **Temática transversal:** Cualquier personaje de cualquier universo puede coexistir mecánicamente.
- **Profundidad accesible:** Fácil de aprender, difícil de dominar.
- **Ilusión del coleccionista:** Abrir sobres, completar colecciones, construir mazos óptimos.
- **Arte parodia:** Las cartas parecen adaptaciones de juegos reales, con bordes recortados, tachones, notas manuscritas del Collector.
- **Aprovechar el medio digital:** Mecánicas que en mesa serían un engorro (cooldowns, Contratiempo, dados virtuales de N caras) se gestionan solas en digital. Es la palanca de diferenciación.

### 1.3 Identidad Única
> "Marvel Champions (escenarios PVE asimétricos, enemigo + esquema) + Star Wars Destiny (azar controlable, turnos alternos) + Slay the Spire (progresión roguelite dentro de la batalla) + Meta-juego TCG (colección, construcción de mazos entre runs)"

Nadie ha juntado exactamente estas piezas. La diferenciación clave: **2 acciones por turno, sin rondas, con azar compartido en los Núcleos modificables digitalmente, combos opcionales, y mecánicas que solo el digital permite (cooldowns, Contratiempo, dados de N caras).**

### 1.4 Lore del Collector
Eres un apasionado de los juegos de cartas. Tu habitación está llena de cajas de MTG, sobres de Destiny, cartas dobladas de One Piece, mazos de Marvel Champions. Un día decides que, en vez de buscar oponentes, crearás tu propio sistema para jugar solo. Adaptas las cartas, tachas reglas, añades tus propias mecánicas. Cada carta en tu colección es una "versión Collector" de una carta real, con tu sello personal.

---

## 2. MECÁNICAS CORE

### 2.1 Estructura del Turno
- **2 acciones por turno**, alternos (jugador → enemigo).
- **No hay rondas.** La partida transcurre en una secuencia continua de turnos.
- **Combo** permite una 3ª acción (ver 2.5). Sigue siendo premium.
- **Duración estimada:** 15-30 minutos por batalla.

### 2.2 Inicio del Turno del Jugador
1. **Efectos de inicio de turno** (umbrales de Trama activos, etc.).
2. **Cooldowns propios** bajan en 1 (si > 0).
3. **Eliges una opción** (rápida, no consume acción):
   - **Generar Energía:** +1 Energía (máximo 5).
   - **Canalizar:** +1 carta (máximo 10 en mano).
   - **Auto-reglas:** con 10 cartas en mano, generas Energía automáticamente; con 5 de Energía, robas automáticamente.
4. **Realizas tus 2 acciones.** En cada acción puedes:
   - Activar una habilidad del Líder (si CD = 0) → gasta Energía si la pide + 1 Núcleo.
   - Activar una habilidad de un Aliado en mesa (si CD = 0) → gasta tu acción + 1 Núcleo.
   - Bajar una carta de mano → gasta Energía. La carta va a mesa o resuelve su efecto.
   - **Canalizar** o **Generar Energía** como acción de emergencia (plan B, siempre disponible).
> **Nunca hay Acción Muerta:** el CD1 del Líder es siempre ⚫ (cualquier Núcleo), y Canalizar/+Energía siempre están disponibles como acción de reserva.

### 2.3 Sistema de Núcleos (Azar Compartido)
- **5 colores base** (mecánica interna). **Valores base: 1-4.**
- Pool compartido entre jugador y enemigo.
- En cada acción que active una habilidad, gastas **1 Núcleo** del color/valor requerido.
- Cuando se agotan **todos**, se **relanzan automáticamente**.
- **Quien actúa después del vaciado elige primero** del nuevo pool.
- **No se puede pasar** si hay Núcleos disponibles del color correcto.
- **Gramática del Núcleo (B+ umbral):** el valor del Núcleo se suma o multiplica según la habilidad; umbral ≥3 activa un bonus.

#### 2.3.1 Dados Virtuales — Mecánica Digital Exclusiva
El rango de los Núcleos (base 1-4) puede ser **modificado temporalmente** por cartas, habilidades, pasivos o escenarios:
- *"Los Núcleos de 🔴 valen mínimo 3 este turno"* → el dado se trunca por abajo.
- *"El siguiente Núcleo que gastes vale 4"* → fija el valor.
- *"Todos los Núcleos son impares"* → filtra valores.
- *"El pool se relanza con dados de 6"* → expande temporalmente el rango.
- *"Los Núcleos valen máximo 2 este turno"* → comprime el dado.
Esto sería imposible de gestionar en un juego físico. En digital es un número en memoria. **Es una de las palancas de diferenciación clave del juego.**

### 2.4 Notación de Costes
| Notación | Significado |
|----------|-------------|
| **⚫** | Un Núcleo de cualquier color, cualquier valor |
| **🔴** | Un Núcleo rojo, cualquier valor |
| **⚫3** | Un Núcleo de cualquier color, mínimo valor 3 |
| **🔴3** | Un Núcleo rojo, mínimo valor 3 |
| **🔴🟡🟢** | Un Núcleo de cualquiera de esos colores |

El número sobre el icono siempre significa "mínimo". El tooltip lo aclara.

### 2.5 Cooldowns y Calentamiento
- Cada habilidad tiene un CD. **CD mínimo = 1, nunca 0.**
- El CD baja 1 por cada **acción propia** del jugador. No cuenta: combos, acciones del enemigo, ni el turno de lanzamiento.
- **CD1 del Líder siempre ⚫, y siempre puro** (sin +X/×X/Umbral) → garantiza acción válida en cualquier turno, sin modificador de fábrica. Los modificadores empiezan a aparecer en CD2+. Norma sólida con posible excepción deliberada por identidad.
- **Calentamiento:** al empezar la partida (y al bajar un Aliado/permanente con habilidades), todas las habilidades arrancan **"como recién usadas"** (en cooldown). El enemigo también arranca en cooldown.

### 2.6 Combo (Keyword)
- Algunas habilidades/cartas tienen la keyword **"Combo"** (tooltip: "permite una acción extra este turno").
- Si la acción anterior generó Combo, puedes encadenar una **3ª acción** pagando costes normales.
- No puedes repetir la misma habilidad en la misma cadena.
- **Siempre aprovechable:** Canalizar y +Energía están disponibles como acción de relleno, así que un Combo nunca debería desperdiciarse por falta de jugada válida.
- **Combo es opcional como pieza de mazo.** Mazos sin cartas que generen Combo son perfectamente viables.

### 2.7 Contratiempo (Keyword)
- **Counter diferido.** Carta que juegas como acción en tu propio turno. **Paga Energía.**
- Deshace efectos del **turno enemigo inmediatamente anterior** (1 turno atrás).
- **No restaura el pool de Núcleos.** Deshace efectos (daño, Trama, estado, carta de Dramaturgia).
- **Alcance según la carta:** algunas revierten solo el daño, otras la carta de Dramaturgia entera.
- **Lo cancelado se descarta**, no vuelve al mazo del enemigo.
- **Excepción letal:** si el golpe iba a ser letal, el Contratiempo salta en tiempo real, pero **sigue costando tu acción** y necesitas la Energía disponible.

### 2.8 Defensa y Escudos (proactiva)
- **Defensa X** crea **X fichas de escudo persistentes** (no se evaporan al final del turno).
- Cada punto de daño entrante consume 1 ficha antes de tocar tu vida.
- **El daño no tiene Arrollar por defecto:** si el daño supera las fichas de escudo, el exceso **se pierde** (no pasa a vida). Solo pasa si la habilidad tiene la keyword **Arrollar**.
- **Tope global de escudo del Líder: 5** (punto de partida). Apilar de más rebosa y desperdicia.
- **Los Aliados no generan escudo.** El escudo es del Líder.

---

## 3. SISTEMA DE COMBATE

### 3.1 Personaje (Líder)
- Cada personaje tiene **4 habilidades base** fijas (plantilla por defecto CD 1/2/3/4).
- **CD1 siempre ⚫** (nunca queda sin acción válida).
- **3 niveles de Líder** (Level-Up en batalla): ver 6.3.
- **Pool de 10 cartas propias** asociadas al personaje.

### 3.2 Mazo del Jugador
- **Tamaño:** 30 cartas.
- **Mínimo:** 5 cartas del personaje. **Máximo:** 20 (10 tipos × 2 copias).
- **Límite de copias:** Máximo 2 por carta. **Cartas Únicas:** solo 1 con ese nombre en el mazo.
- **Deck-out:** al agotarse el mazo se **rebaraja el descarte** (mazo infinito). El mill solo es amenaza si un escenario/enemigo lo convierte en condición.

### 3.3 Tipos de Cartas
| Tipo | Descripción |
|------|-------------|
| **Equipo** | Permanente: pasivos o habilidades activas. |
| **Aliado** | Personaje con vida que bloquea daño **desde que entra** (sin warmup para el bloqueo). Sus habilidades activas arrancan en cooldown. |
| **Evento** | Efecto instantáneo. Usar y descartar. |
| **Contratiempo** | Carta que en tu turno deshace lo que hizo el enemigo el turno anterior. |

> **Aliados y bloqueo:** entran a mesa y pueden bloquear daño inmediatamente. Lo que no pueden hacer en el turno de entrada es activar sus habilidades (están en cooldown). El jugador elige libremente si redirigir el daño al Aliado o no — **sin gastar acción.**
>
> **Arrollar:** keyword que indica que el daño excedente al Aliado/escudo pasa al Líder. Sin esta keyword, el exceso se pierde.

### 3.4 Enemigo
- **Una acción por turno:** siempre empieza **robando la carta superior de Dramaturgia**.
- La carta tiene icono **⚔️** o **📜**:
  - ⚔️ → ejecuta habilidad de ataque (según IA de prioridades).
  - 📜 → ejecuta habilidad de Trama.
- La carta también resuelve **su propio efecto** (invocar secuaz, daño extra, etc.).
- **No usa Energía. Solo Núcleos.**
- **Calentamiento:** arranca en cooldown. Sin alpha-strike en su primer turno.
- **CD1 doble:** a diferencia del Líder, el Enemigo tiene **2 habilidades en CD1** — una básica de Ataque y una básica de Trama, ambas siempre ⚫. Garantiza que el icono de la carta (⚔️/📜) siempre tiene relleno disponible, sin importar el estado de calentamiento de las habilidades de mayor CD. Modificador opcional ±2 por enemigo (identidad temprana).
- **Fases:** 2-3 (variable). Cambios según vida, turnos o condiciones.
- **Tope blando de vida: ningún enemigo supera 100HP**, en ningún nivel de dificultad. Ritmo lento se corrige ajustando habilidades, no inflando vida.

### 3.5 IA de Prioridades del Enemigo
```
Cuando la carta es ⚔️:
  1. Habilidad firma  — si tiene Núcleo mínimo disponible
  2. Básica de Ataque — siempre disponible (⚫, CD1)

Cuando la carta es 📜:
  1. Habilidad de Trama de mayor CD — si está desbloqueada
  2. Básica de Trama — siempre disponible (⚫, CD1)

Capa 2 — qué Núcleo gastar (coste ⚫):
  → Prioriza colores del jugador con valor ≥3 (denegar)
  → Si no los hay: mayor valor disponible
  → Si empate o no hay colores del jugador: cualquiera
```
Patrones aprendibles. Telegrafío parcial. Negar el Núcleo alto degrada al enemigo, no lo apaga.

### 3.6 Trama (Mecánica del Escenario)
- Cada escenario tiene una **Trama** con contador. **No es un timer automático: es un recurso bidireccional.**
- **Sube** cuando el enemigo ejecuta habilidad 📜 o cuando cartas de Dramaturgia lo indican.
- **NO sube automáticamente** cada turno del enemigo.
- **Efectos variables por umbrales escalados** (peores cuanto más alto). Umbral final = derrota alternativa.
- **Se frena con:** habilidad de Líder anti-Trama, carta de jugador anti-Trama, u objetivos del escenario.
- **Trama X** como keyword: sin +/-. El contexto indica la dirección (enemigo/Dramaturgia = sube, jugador = baja). Si un escenario invierte esto, lo dice explícitamente.
- **El daño de Trama es inabsorbible** (el muro de Aliados no protege del reloj).

### 3.7 Aliados y Absorción
- El enemigo apunta siempre al **Líder.** Tú rediriges el daño a un Aliado **por elección, sin gastar acción.**
- **Absorbible vs inabsorbible:** propiedad del daño (escrito explícitamente). Por defecto, absorbible.
- Vida del Aliado escala con su coste en Energía (ver Sistema y Balanceo).
- Sus habilidades cuestan tu acción + Núcleo. CD variable.
- **Berserker:** Aliado incontrolable de mucha vida. Toda la absorción va a él obligatoriamente.
- **Baraja sin Aliados es viable:** defensa proactiva 🟢 + Contratiempo + ritmo agresivo.

### 3.8 Secuaces (del enemigo)
- Iniciativa propia. Daño bajo. Sin límite de presencia. **Solo 1 actúa por turno enemigo.**
- **Presencia pasiva:** mientras están en mesa, cada esbirro aporta un efecto pasivo **definido por el enemigo y/o el escenario** (acumulable entre ambas fuentes, sin tope). La presión escala con cuántos dejes vivos, aunque solo 1 ataque por turno. Esto hace que "estar en mesa" pese sin romper la asimetría de acciones.
- **Selección del que actúa:** aleatorio **con filtro de validez** — entre los que pueden ejecutar su acción (no en CD, Núcleo disponible). Si ninguno tiene acción especial, uno al azar usa su ataque plano.
- **Keyword Defensor:** obliga a recibir/atacar a ese secuaz primero.

---

## 4. PERSONAJES Y MAZOS

### 4.1 Sistema de Colección de Líderes (TCG)
**Sobre de Personaje:**
```
1  × Carta de Líder
5  × Cartas de Personaje (aleatorias del pool de 10)
9  × Cartas Comunes de jugador
─────────────────────────────
15 cartas totales
```
- **5 sobres iniciales** al empezar el juego (aleatorios).
- **Pool de Comunes de jugador:** 50 cartas al lanzamiento (~10 por Líder inicial). Crece con nuevos Líderes.

### 4.2 Construcción de Mazo
- Preparas el mazo entre runs en tu habitación.
- Mínimo 5 cartas del personaje, máximo 20. Resto hasta 30: cartas comunes.
- Puedes ver las versiones evolucionadas del Líder y sus cartas desde la habitación.

### 4.3 Progresión del Personaje (Level-Up del Líder)
- **3 niveles:** inicial + máximo 2 subidas. Definidos en el editor al crear el Líder.
- Visibles en la carta desde la habitación.
- Efectos posibles: +daño, +1 a una habilidad, −1 coste, perder un backlash, etc.
- Se gana **durante la batalla**, se mantiene en campaña, resetea a Nivel 1 en campaña nueva.

---

## 5. ENEMIGOS Y ESCENARIOS

### 5.1 Escenarios (LCG)
**Sobre de Escenario:**
```
1  × Carta de Escenario (reglas Trama + pasivos siempre activos)
8  × Cartas de Escenario (4 tipos × 2 copias)
2  × Cartas únicas de Escenario
5  × Cartas Comunes de Dramaturgia
─────────────────────────────────────
16 cartas totales
```

### 5.2 Enemigos (LCG)
**Sobre de Enemigo:**
```
1  × Carta de Enemigo
8  × Cartas de Enemigo (4 tipos × 2 copias)
2  × Cartas únicas de Enemigo
5  × Cartas Comunes de Dramaturgia
─────────────────────────────────────
16 cartas totales
```
- 3 niveles de dificultad. Nivel 2 desbloquea al ganar N1. Nivel 3 al ganar N2.
- Recompensa Nivel 3: Insignia única.

### 5.3 Mazo de Dramaturgia — 30 cartas
| Origen | Cartas |
|--------|--------|
| Cartas de Enemigo | 10 (4×2 + 2 únicas) |
| Cartas de Escenario | 10 (4×2 + 2 únicas) |
| Cartas Comunes | 10 (5 del sobre Enemigo + 5 del sobre Escenario) |
| **Total** | **30** |

- El ratio ⚔️/📜 emerge naturalmente de las cartas incluidas.
- **Pool de Comunes de Dramaturgia:** 30 cartas al lanzamiento. Crece con nuevos sets.
- **Modo Constructor (endgame):** intercambia las 10 comunes por otras del pool.

---

## 6. PROGRESIÓN Y META-JUEGO

### 6.1 Estructura de la Batalla
- Un escenario + un enemigo + un nivel. La batalla ES la run.
- Objetivos visibles al inicio.

### 6.1.bis Dificultad = Tiempo (Principio)
- La dificultad se mide en **tiempo real de partida, no en turnos**: mega fácil ~5 min · fácil ~10 · normal ~15 · difícil ~20 · reto más.
- El tiempo por turno sube con la dificultad (fácil = automático; difícil = obliga a pensar).
- La duración se alarga con **densidad de decisión**, nunca inflando vida (sin esponjas). Combates más largos = más fases/mecanismos/secuaces con efectos, no más HP.
- **Tope blando de vida de enemigo: 100HP máximo**, sin excepción, en cualquier nivel de dificultad.

### 6.2 Sistema de Objetivos y Recompensas
| Objetivo | Recompensa |
|----------|------------|
| Derrotar enemigo (N1/2/3) | X sobres base + Créditos |
| Objetivo secundario A | Sobre de Oro + Créditos |
| Objetivo secundario B | Sobre de Plata + Créditos |
| Objetivo terciario (oculto) | Créditos extra |

- Puedes perder la batalla pero conservar recompensas de objetivos cumplidos.

### 6.3 Evolución de la Baraja Durante la Batalla
- **Checkpoints fijos** (cambio de fase) + **variables** (texto enemigo/escenario).
- **Pantalla "elige 1 de 3"** sin gastar turno (Slay the Spire style).
- **Triggers:** cambio de fase, texto enemigo/escenario, umbral de Trama, objetivo cumplido, derrota de secuaces.
- **No se elimina cartas.** Solo mejora, transforma o añade.
- **Level-Up del Líder:** máximo 2 subidas. 3 niveles definidos en editor.
- Persiste en campaña. Nunca toca la colección permanente.

---

## 7. ECONOMÍA Y RECOMPENSAS

### 7.1 Moneda: Créditos
- Derrotar enemigo: 100/200/350 (N1/2/3).
- Objetivos secundarios: +50. Terciarios: +25.

### 7.2 Sobres
| Tipo | Contenido | Modelo |
|------|-----------|--------|
| **Sobre de Personaje** | 1 Líder + 5 cartas personaje + 9 comunes | TCG (aleatorio) |
| **Sobre de Enemigo** | 1 Enemigo + 8 cartas + 2 únicas + 5 comunes Drama. | LCG (set fijo) |
| **Sobre de Escenario** | 1 Escenario + 8 cartas + 2 únicas + 5 comunes Drama. | LCG (set fijo) |
| **Sobre de Oro** | Cartas raras/premium | Recompensa objetivo |
| **Sobre de Plata** | Cartas intermedias | Recompensa objetivo |

---

## 8. MODOS DE JUEGO

### 8.1 Modo Libre (Principal)
Elige Líder + Enemigo + Escenario + Nivel. Batalla individual.

### 8.2 Campaña
Secuencia de 2-4 batallas. Requiere sets específicos. La evolución de batalla persiste.

### 8.3 Modo Constructor (Endgame)
Personaliza el mazo de Dramaturgia del enemigo con las cartas que tienes.

### 8.4 Desafíos Diarios/Semanales
Condiciones específicas. Recompensas extra.

---

## 9. TEMÁTICA Y UNIVERSO

### 9.1 Principio Transversal
Cualquier personaje de cualquier universo puede coexistir. Los 5 colores de Núcleo se renombran por universo.

### 9.2 Ejemplos de Universos Soportados
| Universo | Colores Núcleos |
|----------|-----------------|
| Superhéroes | Tecnología, Fuerza, Velocidad, Mentira, Orden |
| Star Wars | Fuerza, Sable, Blaster, Tecnología, Oscuridad |
| Anime (DBZ) | Ki, Técnica, Transformación, Destrucción, Redención |
| Piratas (OP) | Aire, Fuego, Agua, Tierra, Haki |
| Original | Brasa, Temple, Yunque, Mena, Crisol |

> Mapeo funcional: 🔴 Agresión · 🔵 Control · 🟢 Defensa · 🟡 Recurso · 🟣 Caos.

---

## 10. SISTEMA DE KEYWORDS

| Keyword | Significado | Nota |
|---------|-------------|------|
| **Ataque** | Daño = valor del Núcleo gastado | Base sin modificador |
| **Ataque +X** | Daño = Núcleo + X | Más común en Líderes |
| **Ataque ×X** | Daño = Núcleo × X | Premium, posible auto-daño |
| **Ataque -X / /X** | Modificadores negativos | Capa futura |
| **Caos (auto-daño)** | Toda habilidad 🟣 inflige auto-daño = valor del Núcleo gastado | Regla de color, no de carta |
| **Trama X** | Mueve el contador X pasos (dirección por contexto) | Enemigo sube, jugador baja |
| **Defensa X** | X fichas de escudo persistentes (tope 5) | Proactiva |
| **Umbral** | Si el Núcleo gastado es ≥3, efecto extra | 50% de frecuencia en base 1-4 |
| **Combo** | Permite encadenar una acción extra este turno | Premium, siempre aprovechable |
| **Arrollar** | El daño excedente al Aliado/escudo pasa al Líder | Sin keyword = exceso perdido |
| **Defensor** | (Secuaces enemigos) obliga a recibir/atacar a este primero | Taunt |
| **Berserker** | Aliado incontrolable: toda absorción va a él obligatoriamente | Rareza |

---

## 11. ARTE Y ESTÉTICA

- Parodia/estilo de juegos de cartas reales.
- Bordes recortados, pegatinas, tachones, notas manuscritas del Collector.
- La interfaz simula una "habitación de coleccionista".
- Sobres con logo del universo original + sello "Collector's Edition".
