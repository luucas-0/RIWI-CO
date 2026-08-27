# RIWI-CO — Prueba técnica de arquitectura y desarrollo fullstack

Este repositorio contiene la solución completa para la prueba técnica de Riwi Co. S.A.S. El objetivo es construir una plataforma interna de mensajería segura, organizada, responsiva y en tiempo real, cumpliendo con requisitos estrictos de negocio, seguridad y arquitectura.

## 1. Propósito del proyecto

Riwi Co. S.A.S. requiere modernizar su comunicación interna mediante una plataforma de mensajería organizada, segura, responsiva y en tiempo real.

El sistema debe gestionar:
- usuarios
- canales
- mensajes
- estados de lectura
- búsqueda de conversaciones
- consultas a un Copiloto de IA con enfoque RAG
- edición y eliminación lógica de mensajes

## 2. Reglas no negociables

### Seguridad de acceso
- Ningún usuario puede leer, buscar o consultar mensajes o contenido de canales a los que no pertenezca como miembro explícito.
- La seguridad debe estar blindada a nivel de datos en PostgreSQL.
- No se permite acceso global a mensajes.
- La validación debe hacerse en base de datos mediante RLS y permisos transaccionales.

### Base de datos
- Nombre de la base de datos: bd_lucas_mortigo_clan
- Todos los nombres de tablas y columnas deben estar en inglés y con prefijo rw_
- Fechas almacenadas como timestamptz en UTC
- DDL con PK, FK con ON DELETE explícito, UNIQUE, CHECK, NOT NULL, índices y al menos un índice único parcial
- Prohibido borrado físico; usar rw_deleted_at
- Prohibido SQL por concatenación; solo consultas preparadas
- Prohibida la paginación con OFFSET; usar keyset/cursor por timestamp + id

### Arquitectura
- Clean Architecture con capas explícitas: Domain, Use Cases, Infrastructure, Interfaces/Adapters
- El dominio no debe depender del framework ni del driver de base de datos
- JWT con access token de corta vida y refresh token con rotación segura
- El user_id debe obtenerse exclusivamente del JWT verificado en el backend

### Frontend
- Interfaz responsive en móvil y escritorio
- 3 zonas principales:
  1. navegación/canales y perfil
  2. conversación central
  3. panel lateral del copiloto IA
- i18n disponible en español e inglés
- sin cadenas hardcodeadas en componentes

### Copiloto IA / RAG
- Recuperación vectorial con pgvector y similitud coseno
- Búsqueda limitada a canales donde el actor es miembro
- System prompt versionado
- Entradas tratadas como datos no confiables
- Debe responder con citas de fuente y negativa explícita si falta permisos o contexto

## 3. Stack tecnológico obligatorio

- TypeScript
- Next.js (App Router)
- React
- Tailwind CSS
- Node.js / Express
- PostgreSQL 15+ con extensión pgvector
- WebSockets o Socket.io / SSE
- OpenAI SDK
  - text-embedding-3-small
  - gpt-4o-mini
- AIProvider como adaptador intercambiable

## 4. Variables y parámetros del proyecto

- Desarrollador: Lucas Mortigo Cano
- Base de datos: bd_lucas_mortigo_clan
- Prefijo de tablas y columnas: rw_
- Nombre base de la solución: Riwi Co. S.A.S.

## 5. Requerimientos técnicos obligatorios

### 1) Análisis, normalización y modelo de datos
- Construir un Modelo Entidad Relación con entidades, atributos, PK, FK, cardinalidades y justificación del tipo de clave
- Crear seed.json que identifique entidades, relaciones y reglas de negocio implícitas
- Documentar el proceso de normalización hasta 1FN, 2FN y 3FN

### 2) Implementación de base de datos en PostgreSQL
- Base de datos PostgreSQL 15+ con nombre bd_lucas_mortigo_clan
- Nombres en inglés con prefijo rw_
- DDL completo con PK, FK con ON DELETE explícito, UNIQUE, NOT NULL, CHECK y fechas timestamptz
- Al menos un índice único parcial

### 3) Lógica de negocio en la base de datos
- Funciones transaccionales con validación de permisos en BD
- Garantizar que no haya trazas parciales ante errores
- Row Level Security sobre canales y mensajes
- Rol de aplicación sin BYPASSRLS
- Actor fijado por transacción mediante app.current_user_id
- Crear la vista de conversaciones del usuario
- Crear mínimo dos stored procedures:
  - consulta de usuarios
  - procedimiento para edición y eliminación de usuarios

### 4) Búsqueda, recuperación de contexto y seguridad
- Definir cómo el copiloto recupera mensajes de cada usuario
- El copiloto solo debe tener acceso a mensajes de canales donde el actor es miembro
- Usar vectorial para guardar mensajes y embeddings para recuperarlos
- Incorporar trigger para mantener el vector de búsqueda consistente
- Prohibición de borrado físico, SQL por concatenación y OFFSET

### 5) Backend y API REST
- Clean Architecture con dependencias apuntando al dominio
- Casos de uso delgados validando entrada, invocando funciones de BD y mapeando resultados
- Principios SOLID demostrables en código
- Patrón de diseño aplicado solo si se justifica
- API REST con códigos correctos, manejo uniforme de errores, correlación y paginación por keyset

### 6) Autenticación y autorización
- Inicio de sesión verificando contraseñas por hash seguro
- JWT con access token de corta vida y refresh token con rotación almacenado de forma segura
- Proteger rutas y tomar user_id solo del token
- Propagar el actor autenticado a BD y RLS

### 7) Frontend
- Interfaz con mínimo tres zonas: conversación, panel del copiloto y perfil de usuario
- Envío de mensajes con estados pending, sent y failed
- Carga diferida del historial preservando scroll
- Estados de carga, vacío y error
- Responsivo en móvil y escritorio
- Español e inglés
- Sin cadenas incrustadas en componentes

### 8) Copiloto de IA
- Integrar copiloto con enfoque RAG recuperando contexto solo del actor autenticado
- Cada respuesta debe incluir citas a mensajes fuente
- Responder honestamente si no hay contexto suficiente
- El copiloto conoce al usuario autenticado: nombre y cargo
- Contexto construido en el servidor desde el token
- Proveedor intercambiable con interfaz específica, usando OpenAI SDK
- System prompt versionado
- Chats tratados como datos no confiables
- Negativas explícitas por permisos, fuera de alcance o contexto insuficiente

### 9) QA, evidencias y extras
- Mínimo dos pruebas automatizadas contra PostgreSQL real:
  - rechazo a usuario no miembro
  - no retorno de mensajes de canales privados ajenos
- Entregar evidencias en captura o video de máximo 5 minutos mostrando:
  - inicio de sesión
  - envío de mensaje
  - búsqueda
  - respuesta del copiloto con citas
  - negativa correcta por falta de permisos

### 10) Despliegue
- docker compose up debe levantar base de datos, backend y frontend
- Debe existir comando documentado para ejecutar migraciones y cargar el corpus completo
- Incluir .env.example sin secretos reales
- Verificar que el proyecto pueda levantarse en una máquina limpia siguiendo solo el README

### 11) Consultas y funciones SQL requeridas
- Consulta 1: historial de mensajes de un canal con paginación por keyset
- Consulta 2: búsqueda de mensajes con resaltado del término encontrado
- Consulta 3: recuperación de contexto para el copiloto con permisos en SQL
- Consulta 4: consumo acumulado del copiloto por usuario

## 6. Entregables obligatorios

- README.md
- ARCHITECTURE.md
- DECISIONS.md
- seed.json
- schema SQL
- queries SQL
- tests SQL
- proyecto funcional con frontend, backend y PostgreSQL

## 7. Reglas de implementación adicionales

- Normalización estricta hasta 3FN
- Nombres de tablas y columnas en inglés con prefijo rw_
- Índices adecuados para rendimiento y seguridad
- Mensajes con estados pending, sent, failed
- Soft delete y trazabilidad de mensajes editados/eliminados
- Mantener coherencia con la política de aislamiento total de datos

## 8. Instrucción ejecutiva

A partir de este momento, cualquier código, script SQL, componente o arquitectura generada debe cumplir con estas especificaciones al 100%.

La solución debe mantenerse coherente con Clean Architecture, respetar el prefijo rw_ y asegurar el aislamiento total de datos.

## 9. Objetivo final

Entregar una solución completa, segura y ejecutable que demuestre:
- arquitectura sólida
- integridad de datos
- permisos estrictos por canal
- funcionalidad real de mensajería
- copiloto RAG con contexto autorizado
- despliegue reproducible
- evidencia técnica y funcional suficiente para una prueba técnica de 8 horas observadas

## Ejecución de la demostración

1. Copia `.env.example` como `.env` y define `OPENAI_API_KEY` si quieres probar el copiloto. El proveedor configurado es OpenAI, como exige el stack del enunciado; no se debe guardar una clave en `.env.example`.
2. Ejecuta `docker compose up --build`. PostgreSQL crea `bd_lucas_mortigo_clan`, aplica `database/schema.sql` y carga `database/seed.sql` (derivado de `seed.json`) automáticamente en un volumen nuevo.
3. Inicia sesión en `POST /auth/login` con `lucas@riwi.co` y la contraseña `RiwiDemo2026!`. La respuesta contiene access token y refresh token rotativo.
4. Envía `POST /channels/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/messages` con `Authorization: Bearer <accessToken>` y `{ "content": "Mensaje de prueba" }`. El mensaje queda persistido y se emite por Socket.io.
5. Consulta `POST /copilot/ask` con el mismo token y `{ "question": "¿Cómo está el despliegue?" }`. Requiere `OPENAI_API_KEY`; recupera solo mensajes visibles por RLS y devuelve sus identificadores como citas.

La interfaz en `http://localhost:3000` implementa login, canales autorizados, historial, búsqueda, envío con estado y panel de copiloto. Ejecuta los scripts de seguridad contra el contenedor con `docker compose exec -T db psql -U postgres -d bd_lucas_mortigo_clan -f /dev/stdin < database/tests/rls_access_test.sql` y repite con `rls_isolation_test.sql`.

Para reinicializar los datos de prueba, ejecuta `docker compose down -v` y vuelve a levantar el compose. No uses ese comando si quieres conservar datos locales.
