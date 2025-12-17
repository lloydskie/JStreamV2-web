# jstream

A responsive, accessible, Netflix-inspired movie streaming UI clone built with only HTML, CSS, and vanilla JavaScript.

## Features
- **Dark theme** with modern, cinematic look
- **Hero banner** with parallax effect
- **Horizontal carousels** for movie browsing (scrollable, keyboard accessible)
- **Modal overlay** for movie details (accessible, focus-trapped)
- **Sticky header** with hide-on-scroll and search bar
- **Responsive**: mobile, tablet, desktop
- **Animations**: smooth transitions, card hover, modal fade/scale, scroll inertia
- **Performance**: lazy-load images, blurred placeholders
- **Accessibility**: semantic HTML, ARIA, focus states, skip-to-content
- **No frameworks**: pure HTML, CSS, JS
- **Branding**: all "jstream" (no Netflix or trademarked names)

## Project Structure
```
jstream/
  index.html
  css/
    styles.css
  js/
    app.js
  data/
    movies.json
  assets/
    favicon.png
    placeholder.png
    placeholder-blur.png
    ...movie images...
```

## Run Instructions
1. **Download or clone** this repository.
2. **Open `index.html` in your browser.**
   - No build step or server required (all static files).
3. **Replace images** in `assets/` with your own posters/backdrops for a custom look.

## Performance Notes
- Use local images for faster loading.
- Keep high-resolution images under 200 KB to optimize performance.
- Minimize animations for users with `prefers-reduced-motion` enabled.

## Customization
- Replace `data/movies.json` with your own movie data.
- Update CSS variables in `styles.css` to rebrand colors, spacing, and typography.

## Local Testing
1. Open `index.html` in your browser.
2. Ensure all assets are loaded correctly.

## Accessibility Checklist
- **Keyboard Navigation**: Fully supported for carousels, modals, and buttons.
- **ARIA Attributes**: Used for modals, carousels, and live regions.
- **Reduced Motion**: Animations respect `prefers-reduced-motion` settings.

---

**jstream** is a demo project for educational and prototyping purposes. No backend, authentication, or real streaming is included.

## License
This project is open-source and available under the MIT License.
