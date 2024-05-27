<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Msg - Your Lightweight Chat Buddy</title>
    <link rel="icon" type="image/png" href="{{ asset('public/assets/images/icon.png') }}">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css">
    <style>
        body {
            background-color: #f8f9fa;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }
        .hero {
            background-color: #6c757d;
            color: #fff;
            padding: 3rem 1rem;
            text-align: center;
            position: relative;
        }
        .features {
            padding: 3rem 1rem;
            background-color: #fff;
            border-radius: 10px;
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
        }
        .feature-card {
            margin-bottom: 2rem;
            border: none;
            border-radius: 10px;
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease-in-out;
        }
        .feature-card:hover {
            transform: translateY(-5px);
        }
        .feature-card .card-body {
            padding: 2rem;
        }
        .feature-card h5 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #343a40;
        }
        .feature-card p {
            color: #6c757d;
            font-size: 1rem;
            line-height: 1.6;
        }
        footer {
            background-color: #6c757d;
            color: #fff;
            text-align: center;
            padding: 1.5rem 0;
            position: fixed;
            bottom: 0;
            width: 100%;
        }
        .auth-links {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
        }
        .auth-links a, .auth-links form {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
        }
        .auth-links a:hover {
            color: #ccc;
        }
        .auth-links form {
            margin: 0;
        }
    </style>
</head>
<body>
    <header class="hero">
        <div class="container">
            <h1>Msg - Your Lightweight Chat Buddy</h1>
            <p class="lead">Real-time messaging, simplified.</p>
            <div class="auth-links">
                @if (Route::has('login'))
                    @auth
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="btn btn-link" style="color: #fff; text-decoration: none; font-weight: bold; padding: 0; border: none; background: none;">
                                Logout
                            </button>
                        </form>
                        <a href="{{ route('home') }}">Go to Messages</a>

                    @else
                        <a href="{{ route('login') }}">Log in</a>

                        @if (Route::has('register'))
                            <a href="{{ route('register') }}">Register</a>
                        @endif
                    @endauth
                @endif
            </div>
        </div>
    </header>

    <main>
        <section class="features">
            <div class="container">
                <div class="row">
                    <div class="col-md-4">
                        <div class="feature-card card">
                            <div class="card-body">
                                <h5 class="card-title">Real-Time Messaging</h5>
                                <p class="card-text">Instant messaging with real-time updates using websockets and Pusher.io.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="feature-card card">
                            <div class="card-body">
                                <h5 class="card-title">User Profiles</h5>
                                <p class="card-text">Access detailed user profiles directly from the chat interface.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="feature-card card">
                            <div class="card-body">
                                <h5 class="card-title">Image Sharing</h5>
                                <p class="card-text">Share images within your conversations.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <p>&copy; {{ config('app.name') }} {{ date('Y') }}. All rights reserved. Developed by Pratik Bhujel.</p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
