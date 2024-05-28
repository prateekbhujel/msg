<div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel"
aria-hidden="true">
<div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
        <div class="modal-body">
            <form action="#">

                <div class="file profile-file">
                    <img src="{{ asset(auth()->user()->avatar) }}" alt="Upload" class="img-fluid profile-image-preview">
                    <label for="select_file"><i class="fal fa-camera-alt"></i></label>
                    <input id="select_file" type="file" hidden>
                </div>
                <p>Edit information</p>
                <input type="text" placeholder="Name" value="{{ auth()->user()->name }}">
                <input type="text" placeholder="User Name" value="{{ auth()->user()->user_name }}">
                <input type="email" placeholder="Email" value="{{ auth()->user()->email }}">
                <p>Change password</p>
                <div class="row">
                    <div class="col-xl-6">
                        <input type="password" placeholder="Old Password">
                    </div>
                    <div class="col-xl-6">
                        <input type="password" placeholder="New Password">
                    </div>
                    <div class="col-xl-12">
                        <input type="password" placeholder="Confirm Password">
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary cancel"
                data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary save">Update</button>
        </div>
    </div>
</div>
</div>