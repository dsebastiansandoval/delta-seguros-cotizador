# Entorno de staging

Rama `staging` — para probar las integraciones con las APIs de las aseguradoras
antes de llevarlas a producción, a pedido de las propias aseguradoras.

## Infraestructura

- **Vercel**: Preview Deployment propio de esta rama (mismo proyecto/cuenta que
  producción — ver ARCHITECTURE.md si se decide aislarlo más adelante).
- **Base de datos**: branch separado de Neon (`staging`, clonado de producción y
  luego reconstruido desde cero con `db:migrate` + RLS + `db:seed`/`db:seed:dev`/
  `db:seed:deducibles`) — **solo datos de prueba, nunca una copia de clientes
  reales**. Si se vuelve a clonar desde producción en el futuro, hay que repetir
  esa limpieza antes de usarlo.
- **Variables de entorno**: `AUTH_SECRET` y `DATABASE_URL` están en Vercel,
  scoped a Preview + rama `staging` únicamente — nunca comparten valor con
  producción.

## Correr algo contra esta base desde la máquina local

Sin tocar `.env.local` (que sigue apuntando a producción):

```bash
DATABASE_URL="<connection string de la rama staging en Neon>" npm run db:migrate
```

## Acceso

Login por correo+clave (`/login`), igual que producción — el link para crear
la clave del primer ADMIN se generó con `db:bootstrap-admin` y se entregó por
fuera de este repo.
