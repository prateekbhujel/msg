# Msg - "Your Lightweight Chat Buddy."

## Overview

Msg is a lightweight messaging application built with Laravel. This application leverages websockets, Pusher.io, and Laravel Echo to provide real-time messaging features. Users can send messages, favorite other users, search for users, view user profile details within chats, and more. The application also supports sharing images, private messaging, and deleting own messages in private chats.

## Features

- **Real-Time Messaging**: Instant messaging with real-time updates using websockets and Pusher.io.
- **User Presence**: See which users are online and their activity status.
- **Message Status**: View read and delivered timestamps for messages.
- **User Profiles**: Access detailed user profiles directly from the chat interface.
- **Favorites**: Favorite users for quick access and better organization.
- **Search**: Search for users to initiate new conversations easily.
- **Image Sharing**: Share images within your conversations.
- **Private Messaging**: Secure and private messaging between users.
- **Delete Own Messages**: Users can delete their own messages in private chats.
- **Bootstrap Templates**: Utilizes Bootstrap for responsive and modern UI components.
- **jQuery and Custom CSS**: Enhances interactivity and custom styling.

## Technologies Used

- **Laravel 10**: The PHP framework used for building the application.
- **Websockets**: For real-time communication.
- **Pusher.io**: A service to handle websocket connections.
- **Laravel Echo**: A Laravel library to work with websockets.
- **Bootstrap**: For responsive, mobile-first front-end design.
- **jQuery**: For DOM manipulation and interactivity.
- **Custom CSS**: For additional styling specific to the application.

## Installation

Follow these steps to get a local copy of the project up and running.

1. **Clone the Repository**:
   ```sh
   git clone https://github.com/prateekbhujel/msg.git
   cd msg
   ```

2. **Install Dependencies**:
   Make sure you have [Composer](https://getcomposer.org/) installed, then run:
   ```sh
   composer install
   ```

3. **Environment Configuration**:
   Copy the example environment file and configure the environment variables.
   ```sh
   cp .env.example .env
   ```
   Update the `.env` file with your database and Pusher.io credentials.

4. **Generate Application Key**:
   ```sh
   php artisan key:generate
   ```

5. **Run Migrations**:
   ```sh
   php artisan migrate
   ```

6. **Install Frontend Dependencies**:
   Make sure you have [Node.js](https://nodejs.org/) installed, then run:
   ```sh
   npm install
   npm run dev
   ```

7. **Start the Development Server**:
   ```sh
   php artisan serve
   ```

8. **Run Websockets Server**:
   ```sh
   php artisan websockets:serve
   ```

## Usage

- **Messaging**: Start chatting with other users by searching for their profiles or selecting from your favorites.
- **Favorites**: Click the star icon to favorite a user and access them quickly from your favorites list.
- **User Profiles**: Click on a user's name in the chat to view their profile details.
- **Image Sharing**: Use the image upload button in the chat interface to share images.
- **Private Messaging**: Send secure messages that are only visible to the recipient.
- **Delete Own Messages**: In private chats, users can delete their own messages by clicking the delete icon next to the message.

## Customization

- **Bootstrap Templates**: The application uses Bootstrap for its UI components. You can customize the Bootstrap templates by modifying the HTML files in the `resources/views` directory.
- **jQuery and Custom CSS**: Additional interactivity and styling can be added or modified by editing the `public/js` and `public/css` directories respectively.

## Contributing

We welcome contributions to improve Msg. Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
   ```sh
   git checkout -b feature-name
   ```
3. Make your changes.
4. Commit your changes.
   ```sh
   git commit -m "Description of your changes"
   ```
5. Push to your branch.
   ```sh
   git push origin feature-name
   ```
6. Open a pull request describing your change.

## Acknowledgements

- [Laravel](https://laravel.com/)
- [Pusher](https://pusher.com/)
- [Laravel Echo](https://laravel.com/docs/10.x/broadcasting#installing-laravel-echo)
- [Bootstrap](https://getbootstrap.com/)
- [jQuery](https://jquery.com/)

## Contact

For questions, issues, or suggestions, please open an issue on the [GitHub repository](https://github.com/prateekbhujel/msg/issues).
