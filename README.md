# Personal Habit Tracker

## Deploy With GitHub Pages + Render

GitHub Pages hosts the static frontend. The Express API must run separately on Render, and the API must use a persistent MongoDB Atlas database.

1. Create a GitHub repository and push this `habit-tracker` folder to the `main` branch.
2. In Render, create a Blueprint from the repository. It will detect `render.yaml` and create the backend service.
3. Add these Render environment values:
   - `MONGO_URI`: your MongoDB Atlas connection string
   - `CLIENT_URL`: your GitHub Pages URL, such as `https://your-name.github.io/your-repository`
4. Copy the Render service URL, append `/api`, and add it as a repository variable named `HABIT_API_URL` under **Settings > Secrets and variables > Actions > Variables**.
5. In GitHub, open **Settings > Pages**, choose **GitHub Actions** as the source, then push to `main` to deploy.

The workflow writes the hosted API URL into `frontend/config.js` during deployment. Local development still uses `http://localhost:5000/api` when the variable is empty.

A full-stack habit tracking web app built with:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express.js
- Database: MongoDB
- Authentication: JWT + bcrypt

This project supports:
- User registration and login
- Habit creation, editing, and deletion
- Completion tracking per day
- Duplicate prevention for same habit/date
- Daily, weekly, monthly statistics
- Current and longest streak tracking
- Calendar history view
- Dashboard cards and responsive UI
- Light/dark mode

## Project structure

habit-tracker/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── habits.html
│   ├── calendar.html
│   ├── yearly.html
│   ├── yearly.css
│   ├── yearly.js
│   ├── statistics.html
│   ├── settings.html
│   ├── style.css
│   └── script.js
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Habit.js
│   │   └── Completion.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── habitRoutes.js
│   │   ├── completionRoutes.js
│   │   └── statisticsRoutes.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── habitController.js
│   │   ├── completionController.js
│   │   └── statisticsController.js
│   └── middleware/
│       └── authMiddleware.js
│
├── README.md
└── .gitignore

## 1) Install Node.js

Download and install Node.js from: https://nodejs.org/

Verify that Node and npm are installed:

```bash
node -v
npm -v
```

## 2) Install MongoDB

You can use either:
- MongoDB local server installed on your computer
- MongoDB Atlas cloud database

For local setup:
1. Install MongoDB Community Server.
2. Start MongoDB.
3. The project uses this default local URI:

```env
MONGO_URI=mongodb://127.0.0.1:27017/habit-tracker
```

If you use MongoDB Atlas, replace the URI with your Atlas connection string.

## 3) Configure environment variables

Open backend/.env and update values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/habit-tracker
JWT_SECRET=your_super_secure_jwt_secret_here
CLIENT_URL=http://localhost:5500
```

Important:
- Do not share the JWT secret in public repositories.
- The frontend runs from Live Server on port 5500 by default.

## 4) Install backend dependencies

Open a terminal in the backend folder:

```bash
cd habit-tracker/backend
npm install
```

## 5) Start the backend server

```bash
npm start
```

Or for automatic restart during development:

```bash
npm run dev
```

The server should run at:

```text
http://localhost:5000
```

## 6) Run the frontend in VS Code

1. Open the frontend folder in VS Code.
2. Open any HTML file like login.html.
3. Right-click the file and choose:
   - Open with Live Server
4. If Live Server is not installed, install the VS Code extension: "Live Server".

The frontend will open in the browser at something like:

```text
http://localhost:5500/login.html
```

## 7) How to use the app

1. Open the app in the browser.
2. Register a new user account.
3. Log in with your email and password.
4. Create habits from the dashboard or habits page.
5. Mark habit completion for each day.
6. View progress in dashboard, calendar, and statistics pages.
7. Switch theme from settings.

## 8) API endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/theme
- POST /api/auth/logout

### Habits
- GET /api/habits
- POST /api/habits
- PUT /api/habits/:id
- DELETE /api/habits/:id

### Completions
- POST /api/completions/complete
- POST /api/completions/undo
- GET /api/completions/history
- GET /api/completions/date

### Statistics
- GET /api/statistics
- GET /api/progress
- GET /api/yearly-stats?year=YYYY
- GET /api/yearly-stats/:year/:month

### Completion alias
- POST /api/completions (same behavior as POST /api/completions/complete)

## 9) How the system works

### Frontend
The frontend is built with static HTML, CSS, and JavaScript. Each page uses fetch() to call the Express API. The frontend stores the JWT token in localStorage and sends it in the Authorization header for protected requests.

### Backend
The backend is an Express.js app. It validates requests, protects routes with JWT middleware, and communicates with MongoDB using Mongoose models.

### MongoDB
MongoDB stores:
- users
- habits
- completion records

User passwords are hashed before saving using bcrypt.

### Habit flow
1. User logs in and receives a JWT.
2. The frontend sends the JWT with every request.
3. The backend verifies the token.
4. The user can create habits and mark them complete.
5. The backend prevents duplicate completions for the same habit/date.
6. Statistics and streaks are calculated from completion records in MongoDB.

## 10) Notes for college projects

This project is beginner-friendly and organized into clear model, controller, route, and middleware folders. It is suitable for a college assignment or mini project demonstration.

## 11) Troubleshooting

### MongoDB connection issue
Make sure MongoDB is running. Check the connection string in backend/.env.

### CORS issue
Ensure the frontend origin matches CLIENT_URL in backend/.env.

### JWT/auth issue
Clear browser localStorage and log in again.

### Live Server issue
Use the Live Server extension and load login.html or dashboard.html.

## License
MIT
