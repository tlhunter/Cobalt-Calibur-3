<?php
$map = array();
for($y = 0; $y < 200; $y++) {
    for($x = 0; $x < 200; $x++) {
        $b = null;
        if (rand(1, 100) <= 2) {
            $b = 7;
        }
        $map[$x][$y] = array('g' => 1, 'b' => $b);
    }
}
echo json_encode($map);
