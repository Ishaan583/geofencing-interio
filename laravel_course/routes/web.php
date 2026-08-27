<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});
Route::get(uri:'/about', action: function () {
    return view('about');
});
Route::get(uri:'/product/{id}', action: function ($id) {
    return "product ID =$id";
});