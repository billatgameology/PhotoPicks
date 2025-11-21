# PhotoPicks

A lightweight local photo selection app.

## Setup

1.  **Backend Setup**
    Open a terminal in the `backend` folder:
    ```bash
    cd backend
    npm install
    ```

2.  **Frontend Setup**
    Open a terminal in the `frontend` folder:
    ```bash
    cd frontend
    npm install
    ```

## Running the App

You need two terminals running simultaneously.

1.  **Start Backend**
    ```bash
    cd backend
    npm start
    ```
    Server runs on `http://localhost:3001`

2.  **Start Frontend**
    ```bash
    cd frontend
    npm run dev
    ```
    Open the link shown (usually `http://localhost:5173`) in your browser.

## Usage

-   **Folder Path**: Paste the absolute path of your photo folder in the top input box.
-   **Navigation**: Use Left/Right arrow keys.
-   **Rating**: Press `1`-`5` to set stars. `0` to clear.
-   **Color Labels**:
    -   `6`: Red
    -   `7`: Yellow
    -   `8`: Green
    -   `9`: Blue
