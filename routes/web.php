<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\UserProfileController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    // Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

Route::group(['middleware' => 'auth'], function() {
    Route::get('messenger', [MessengerController::class, 'index'])->name('home');
    Route::post('profile', [UserProfileController::class, 'update'])->name('profile.update');

    //User Search Route
    Route::get('messenger/search', [MessengerController::class, 'search'])->name('messenger.search');

    //Fetchs User by Id
    Route::get('messenger/id-info', [MessengerController::class, 'fetchIdInfo'])->name('messenger.id-info');

    //Send Message
    Route::post('messenger/send-message', [MessengerController::class,'sendMessage'])->name('messenger.send-message');  

    //Fetchs Messages of Selected User
    Route::get('messenger/fetch-messages', [MessengerController::class, 'fetchMessages'])->name('messenger.fetch-messages');

    //Fetchs Conatcts of the logged in User: (Converstations)
    Route::get('messenger/fetch-contacts', [MessengerController::class, 'fetchContacts'])->name('messenger.fetch-contacts');
    
    //Updates the contacts realtime on sending the message
    Route::get('messenger/update-contact-item',  [MessengerController::class, 'updateContactItem'])->name('messenger.update-contact-item');
});