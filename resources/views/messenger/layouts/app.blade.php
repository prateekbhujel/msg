<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, target-densityDpi=device-dpi" />
        <meta name="csrf_token" content="{{ csrf_token() }}">
        <meta name="auth_id" content="{{ auth()->user()->id }}">
    <meta name="id" content="">
        <title>{{ config('app.name') }}</title>
    <link rel="icon" type="image/png" href="{{ asset('assets/images/icon.png') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/all.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/slick.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/venobox.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/emojionearea.min.css') }}">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.css">
    <link rel="stylesheet" href="https://unpkg.com/nprogress@0.2.0/nprogress.css">
    <link rel="stylesheet" href="{{ asset('assets/css/spacing.css') }} ">
    <link rel="stylesheet" href="{{ asset('assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/responsive.css') }}">
    @routes
    {{-- Scripts Vite --}}
    @vite(['resources/js/messenger.js'])
</head>

<body>

    <!--==================================
        Chatting Application Start
    ===================================-->
        @yield('contents')
    <!--==================================
        Chatting Application End
    ===================================-->


    <!--jquery library js-->
    <script src="{{ asset('assets/js/jquery-3.7.1.min.js') }}"></script>
    <!--bootstrap js-->
    <script src="{{ asset('assets/js/bootstrap.bundle.min.js') }}"></script>
    <!--font-awesome js-->
    <script src="{{ asset('assets/js/Font-Awesome.js') }}"></script>
    <script src="{{ asset('assets/js/slick.min.js') }}"></script>
    <script src="{{ asset('assets/js/venobox.min.js') }}"></script>
    <script src="{{ asset('assets/js/emojionearea.min.js') }}"></script>
    <script src="https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.js"></script>
    <script src="https://unpkg.com/nprogress@0.2.0/nprogress.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <!--main/custom js-->
    <script src="{{ asset('assets/js/main.js') }}"></script>
    <script>
        const notyf = new Notyf({
                duration: 5000,
            },

        );
    </script>
    @stack('scripts')
</body>

</html>