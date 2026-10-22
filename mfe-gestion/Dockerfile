# --- Compilación ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# --- Servidor estático ---
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/mfe-gestion/browser /usr/share/nginx/html/mfe-gestion
EXPOSE 4201
