package com.example.translate;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Random;

@Controller
@RequestMapping("/v1")
public class TranslateController {
    @PostMapping("/post")
    public ResponseEntity<?> translate(@RequestBody DTO msg){
        String message = msg.getMessage();
//        System.out.println(message);
        Random random=new Random();
        return ResponseEntity.status(HttpStatus.OK).body(random.nextInt(100, 1000));
    }
}
