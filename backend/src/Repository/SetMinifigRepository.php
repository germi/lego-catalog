<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SetMinifig;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SetMinifig> */
class SetMinifigRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SetMinifig::class);
    }
}
