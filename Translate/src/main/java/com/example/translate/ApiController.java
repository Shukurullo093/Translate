package com.example.translate;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/api")

public class ApiController {

    @GetMapping("/index")
    public String index(){
        return "index";
    }
}
