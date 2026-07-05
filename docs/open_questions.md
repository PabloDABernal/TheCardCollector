# Preguntas abiertas — pendientes de respuesta del Director Creativo

Estado: conversación de validación en curso (Director + Game Designer). Nada de esto está aún en `.ai-studio/memory/` — se formaliza tras cerrar estas preguntas.

## Estructura de run
1. Tras elegir 3 Enemigos + 3 Escenarios, el emparejamiento y orden se sortea al 100%. ¿Es la tensión deseada, o el jugador debería controlar alguna variable (orden sí/cruce no, o reservar un combo para N3)?
2. ¿El sorteo puede cruzar universos (Enemigo Star Wars vs Escenario One Piece) o cada universo va por separado? Afecta tamaño real de la matriz de completitud (~24 celdas si no cruza, ~48 si cruza).
3. ¿Cuándo se elige el Líder? ¿Junto con los 3+3, antes del sorteo?

## Derrota a mitad de run
4. Si pierdes un combate a mitad de run, ¿qué pasa? Tres opciones sobre la mesa (sin decidir):
   - A) Fin de run inmediato (roguelite puro, máxima tensión)
   - B) Reintentas solo ese combate (más amable, diluye peso de mejoras entre combates)
   - C) Sigues con penalización, la celda no cuenta completada (término medio)

## Meta-progresión / matriz de completitud
5. El GDD original (5.2) decía "ganar N1 desbloquea N2 permanentemente por Enemigo" — contradice el sorteo aleatorio de niveles dentro de una run. ¿Los niveles de dificultad se desbloquean de forma permanente en la colección, o el nivel es solo etiqueta de la run actual, sin desbloqueo previo?
6. Si el sorteo repite una celda ya completada de la matriz, ¿das algo extra (insignia/cosmético) o solo Créditos base?

## Mejoras entre combates (dentro de una run)
7. Sugerencias de Game Designer sobre la mesa: elegir 1 de 3 cartas de tu colección para meter temporalmente en el mazo de esa run / alivio-reparación (no poder puro) / "espiar" info del siguiente rival. Evitar comprar poder con Créditos a mitad de run. ¿Cuáles encajan, cuáles no?

## Correcciones ya validadas (para referencia, no repreguntar)
- Costes de habilidad: solo color/genérico, nunca número mínimo. Notación ⚫3/🔴3 del GDD v1 queda obsoleta.
- Núcleo (1-4) alimenta la fórmula vía Umbral, no la condición de pago.
- Cooldown baja 1 por vuelta completa (cuando te vuelve a tocar), no por acción individual.
- Al relanzar pool de Núcleos, elige primero quien le toque el turno inmediatamente después del vaciado.
- Trama la recibe el Escenario, daño lo recibe el Líder — habilidades separadas del Enemigo.
- Habrá habilidades de color neutro para que ningún color de dado quede sin uso.
- Plataforma: móvil primero, adaptable PC, testeo en navegador. Referencia de feel: forcetable.net, strawtable.net.
- MVP: 8 Líderes, 4 Enemigos, 4 Escenarios, 2 universos independientes (ej. Star Wars, One Piece).
- Just for fun, sin monetización, sin restricción de licencias reales.
- Run: eliges 3 Enemigos + 3 Escenarios, se sortea orden/emparejamiento en 3 niveles (N1-N3). Entre combates mejoras cartas. Dentro de cada combate, fases de Enemigo + etapas de Escenario (estilo Marvel Champions).
- Matriz de completitud Enemigo×Escenario×Nivel persiste entre runs. Completar todos los niveles de un Enemigo+Escenario da Créditos. Créditos compran sobres entre runs.
